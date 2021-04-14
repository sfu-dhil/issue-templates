# Issue Templates

Test repository for some issue templates for the DHIL

Language and structure of these inspired by https://github.com/stevemao/github-issue-templates

## How to use

If you're using in a single project (or one not connected to the DHIL), you can add the action to your `.github/workflows/{{yourFile}.yaml`

```yaml
       - uses: actions/checkout@v2
       - uses: actions/setup-node@v2
         with:
           node-version: '14'
       - name: Validate the new issue
         uses: sfu-dhil/issue-templates
         id: validate
         with:
           token: ${{ secrets.GITHUB_TOKEN }}
           issue-number: ${{ github.event.issue.number }}
```

## How to edit / work on stuff

* Download the repository
* Fetch all of the dependencies using npm or yarn
* Start the `ncc` watcher: `npm run watch`
* Modify the code in `index.js`;


If you want to test locally, you will need to get [`act`](https://github.com/nektos/act) and `docker`. Make sure docker is running, and then run
`act` in the root directory.
