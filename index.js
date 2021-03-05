const { inspect } = require("util");
const core = require('@actions/core');
const github = require('@actions/github');

try{
    const token = core.getInput('token');
    const issueNumber = core.getInput('issue-number');
    const repository = process.env.GITHUB_REPOSITORY;
    const repoTokens = repository.split("/");
    const owner = repoToken[0];
    const repo = repoTokens[1];
    core.debug(`repository: ${repository}`);
    const octokit = github.getOctokit(token);
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