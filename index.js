
const core = require('@actions/core');
const github = require('@actions/github');
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

async function go(){
    try{
        let thisIssue = await octokit.issues.get(cfg);
        let thisIssueBody = thisIssue.data.body;
        let thisTemplate = await octokit.repos.getContent({
            owner: owner,
            repo: repo,
            path: '.github/ISSUE_TEMPLATE/bug_report.md',
        });
        // Now get it in HTML
        let thisTemplateBody = Buffer.from(thisTemplate.data.content,'base64').toString();
        let errors = await validate(thisIssueBody, thisTemplateBody);
        if (errors.length > 0){
            console.log(`Found ${errors.length} errors....`);
            const comment = await postComment(errors);
            console.log('Posted comment!');
        }
        core.info(issueNumber);
    } catch (e){
        console.log(e);
    }
}

async function postComment(errors){
    const body = renderBody(errors);
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

function renderBody(errors){
    let preamble = `Hi! It looks like this issue is missing ${errors.length} of the required fields: `;
    let list = errors.map(err => `    * ${err.text}`).join("\n");
    let suffix = `Please fill out the rest of this template by editing your above comment \ 
(and sorry if I've erroneously flagged this as incomplete! I'm just an automaton.)`;
    return `${preamble}\n\n${list}\n\n${suffix}`;
}

async function parseDoc(text){
    return new Promise(async (resolve, reject) => {
        try{
            let rendered = await octokit.markdown.render({
                text: text
            });
            resolve(JSDOM.fragment(rendered.data));
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

async function validate(data, template) {

    const getIds = (frag) => {
        return [...frag.querySelectorAll('a[id $="required"]')].map(a => {
            let heading = a.parentNode;
            return {
                'id': a.getAttribute('id'),
                'text': heading.textContent.trim(),
            }
        });
    }

    return new Promise(async (resolve, reject) => {
        try {
            let dataHTML = await parseDoc(data);
            let templateHTML = await parseDoc(template);
            let requiredIds = getIds(templateHTML);
            let currIds = getIds(dataHTML).map(o => o.id);
            let errors = requiredIds.filter(o => {
                return !currIds.includes(o.id);
            });
            resolve(errors);

        } catch(e){
            console.log(`ERROR: ${e}`);
            reject(e);
        }
    });

}

go().then(()=>{
    console.log('Finished!');
})
