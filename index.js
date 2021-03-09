const { inspect } = require("util");
const core = require('@actions/core');
const github = require('@actions/github');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM(`<!DOCTYPE html><body></body>`);
const DOMParser = dom.window.DOMParser;
const { promises: fs} = require('fs');
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
        let errors = validate(thisIssueBody, thisTemplateBody);
        console.log(errors);
        core.info(issueNumber);

    } catch (e){
        console.log(e);
    }
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
   let dataRendered = await octokit.markdown.render({
       text: data
   });
   let templateRendered = await octokit.markdown.render({
        text: template
    });
   console.log(dataRendered.data);
   console.log(templateRendered.data);

   let dataHTML = new DOMParser().parseFromString(dataRendered.data, 'text/html')
   let templateHTML = new DOMParser().parseFromString(templateRendered.data, 'text/html');

   let requiredIds = [...templateHTML.querySelectorAll('a[id]')]
       .filter(a => /_required/gi.test(a.getAttribute('id')));
   console.log(requiredIds);
   let errors = [];
   requiredIds.forEach(link => {

       console.log(link);
        let id = link.getAttribute('id');
        if (dataHTML.querySelector('#' + id )){
            return;
        }
        let err = {
            'id': id,
            'text': link.innerText
        }
        errors.push(err);
   });
   console.log(errors);
   return errors;
}

go().then(()=>{
    console.log('ok!');
})
