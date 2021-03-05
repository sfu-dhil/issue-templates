const core = require('@actions/core');
const github = require('@actions/github');

try{
    const inputs = {
        issueNumber: core.getInput("issue-number"),
    };
    core.debug(`Inputs: ${inspect(inputs)}`);
    const repository = process.env.GITHUB_REPOSITORY;
    const repo = repository.split("/");
    core.debug(`repository: ${repository}`);
    const octokit = github.getOctokit(inputs.token);
    core.info(inputs.issueNumber);
} catch (e){
    console.log(e);
}