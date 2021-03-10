
const core = require('@actions/core');
const github = require('@actions/github');
const matter = require('gray-matter');
const marked = require("marked")
const { JSDOM } = require('jsdom');
const token = core.getInput('token');
const issueNumber = core.getInput('issue-number');
const repository = process.env.GITHUB_REPOSITORY;
const repoTokens = repository.split("/");
const owner = repoTokens[0];
const repo = repoTokens[1];
const cfg = {
    owner: owner,
    repo: repo,
    issue_number: issueNumber,
};
const octokit = github.getOctokit(token);
const commenting = core.getInput('comment') === 'true' ? true : false;

/**
 * Driver function to initiate the check
 * @returns {Promise<boolean>} False is validation errors were found; true if not.
 */
async function go(){
    try{
        let thisIssue = await octokit.issues.get(cfg);
        let errors = await validate(thisIssue.data);
        if (errors.length === 0){
            core.info(`No validation errors found.`)
            return true;
        }
        core.info(`Found ${errors.length} errors`)
        const comment = renderComment(errors);
        if (!commenting){
            core.info('Commenting turned off, so ending now...')
            core.info('I would have said: ');
            core.info(comment);
            return false;
        }
        const postedComment = await postComment(comment);
        console.log('Posted comment!');
        return false;
    } catch (e){
        console.log(e);
    }
}

/**
 * Fetches the issue templates specified in the configuration
 * @returns {Promise<[]>} An array of template objects
 */
async function getTemplates(){
    return new Promise(async (resolve, reject) => {
        try{
            let templateArray = JSON.parse(core.getInput('templates'));
            let promises = templateArray.map(async template => {
                let obj = {};
                let response = await octokit.repos.getContent({
                    owner: owner,
                    repo: repo,
                    path: '.github/ISSUE_TEMPLATE/' + template,
                });
                // Parse using the 'grey-matter' to get proper YAML front matter for label checking
                let parsed = matter(Buffer.from(response.data.content, 'base64').toString());
                parsed.html = await parseDoc(parsed.content);
                obj[template] = parsed;
                return obj;
            });
            let results = await Promise.all(promises);
            resolve(results);
        } catch(e){
            console.log(`${e}`);
            reject(e);
        }
    })
}


/**
 * POSTs a comment to the issue using the GitHub API
 * @param body
 * @returns {Promise<unknown>}
 */
async function postComment(body){
    return new Promise(async (resolve, reject) => {
        try{
            const comment = await octokit.issues.createComment(
                Object.assign(cfg, {body: body})
            );
            resolve(comment);
        } catch(e){
            console.log(`ERROR: ${e}`);
            reject(e);
        }
    });

}

/**
 * Creates a markdown comment to be posted to the issue
 * @param errors
 * @returns {string}
 */
function renderComment(errors){
    let preamble = `Hi! It looks like this ${errors[0].name.toLowerCase()} is missing content for the following required field${errors.length > 1 ? 's' : ''}: `;
    let list = errors.map(err => `    * ${err.text}`).join("\n");
    let suffix = `Please fill out the rest of this template by editing your above comment \ 
(and sorry if I've erroneously flagged this as incomplete! I'm just an automaton.)`;
    return `${preamble}\n\n${list}\n\n${suffix}`;
}

/**
 * Parses a markdown text into a HTML fragment
 * @param text
 * @returns {Promise<HTMLDocument>}
 */
async function parseDoc(text){
    return new Promise(async (resolve, reject) => {
        try{
            let rendered = marked(text);
            resolve(JSDOM.fragment(rendered));
        } catch(e){
            console.log(`ERROR: ${e}`);
            reject(e);
        }
    })
}

/**
 * Checks an issue against the template to make sure
 * they align
 *
 * @param data
 * @param template
 * @return [] An array of errors, which might be empty
 */

async function validate(issue) {

    /**
     * Maps all of the parsed fields from the template
     * to return an array of the fields
     * @param frag
     * @returns {[]}
     */
    const getFields = (frag) => {
        let fields = [];
        let children = [...frag.children];
        for (const el of children){
            const isHeading = el.tagName === "H2";
            const thisId = el.getAttribute('id');
            const isRequired = thisId ? thisId.endsWith('required') : false;
            const textContent = el.textContent.replace('/[\s\n\t]+/gi',' ').trim();
            if (isHeading && isRequired){
                let obj = {
                    id: thisId,
                    text: textContent,
                    boilerplate: ""
                }
                fields.push(obj);
            } else {
                if (fields.length > 0){
                    fields[fields.length -1].boilerplate += " " + textContent;
                }
            }
        }
        return fields;
    }

    /**
     * Function to return the object for a singleton object
     * @param obj
     * @returns {Object}
     */
    const flatObj = (obj) => {
        return obj[Object.keys(obj)[0]];
    }

    /**
     * Getter for labels in an event object
     * @param obj
     * @returns {Array}
     */
    const getLabels = (obj) => {
        return flatObj(obj).data.labels;
    };

    /**
     * Cleans a string for comparison
     * @param str
     * @returns {string}
     */
    const clean = (str) => {
        return str.toLowerCase().replace(/[\n\t]+/g,'').trim();
    }

    const templates = await getTemplates();
    const currLabels = issue.labels.map(label => label.name);

    return new Promise(async (resolve, reject) => {
        try{

            // Return the templates that are meant to validate this type of issue
            let schemata = currLabels.map(label => {
                return templates.filter(template => {
                    return getLabels(template).includes(label);
                });
            }).flat();


            if (currLabels.length === 0){
                reject('No labels set, so no template against which to validate.');
                return;
            }

            if (schemata.length > 1){
                reject('More than one template specified.');
                return;
            }

            if (schemata.length === 0){
                reject('No schema for this label, so nothing to validate');
                return;
            }

            let schema = flatObj(schemata[0]);
            let dataHTML = await parseDoc(issue.body);
            let requiredFields = getFields(schema.html);
            let completedFields = getFields(dataHTML);
            let errors = [];
            for (let field of requiredFields){
                let fieldId = field.id;
                let completed = completedFields.find(c => c.id === fieldId);
                // Add the label and name for the validation step
                field.label = currLabels[0];
                field.name = schema.data.name;
                if (!completed){
                    field.type = 'removed';
                    errors.push(field);
                }
                if (completed && clean(field.boilerplate) === clean(completed.boilerplate)){
                    field.type = 'unchanged';
                    errors.push(field);
                }
            }
            resolve(errors);
        } catch(e){
            reject(e);
        }
    });
}

/**
 * Initiate and report.
 */
go().then((status) => {
    core.info(`Finished validation. ${status ? ' No errors found.' : ' Errors found.'}`);
})
