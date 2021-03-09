
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
        console.log(errors);
        core.info(issueNumber);

    } catch (e){
        console.log(e);
    }
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
            console.log(a);
            console.log(a.parentElement);
            return {
                'id': a.getAttribute('id'),
                'text': a.parentElement.innerText
            }
        });
    }

    return new Promise(async (resolve, reject) => {
        try {
            let dataHTML = await parseDoc(data);
            let templateHTML = await parseDoc(template);
            let requiredIds = getIds(templateHTML);
            let currIds = getIds(dataHTML).map(o => o.id);
            console.log(currIds);
            console.log(requiredIds);
            let errors = requiredIds.filter(o => {
                return !currIds.includes(o.id);
            });
            console.log(errors);
            resolve(errors);

        } catch(e){
            console.log(`ERROR: ${e}`);
            reject(e);
        }
    });

}

go().then(()=>{
    console.log('ok!');
})
