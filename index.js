const { inspect } = require("util");
const core = require('@actions/core');
const github = require('@actions/github');
async function go(){
    try{
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
            headers: {
                "Accept": "application/vnd.github.v3.full+json"
            }
        };
        core.debug(`repository: ${repository}`);
        const octokit = github.getOctokit(token);
        let thisIssue = await octokit.issues.get(cfg);
        console.log(thisIssue);
        let body = thisIssue.body;
        console.log(body);
        console.log(thisIssue.body_html);
        await octokit.issues.addLabels({
            owner: owner,
            repo: repo,
            issue_number: issueNumber,
            labels: ['test']
        });
        core.info(issueNumber);

    } catch (e){
        console.log(e);
    }
}

go().then(() => {
    console.log('Finished!');
})
