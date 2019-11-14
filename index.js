require('dotenv').config();
const Octokit = require("@octokit/rest");
const fs = require('fs');
const initData = JSON.parse(fs.readFileSync('init-data.json'));
const octokit = Octokit({
    auth: process.env.GITHUB_PERSONAL_TOKEN
});

var orgRepos = null;
var studentRepos = null;

console.log('Starting repo initialization.');

(async () => {
    orgRepos = await octokit.repos.listForOrg({
        org: process.env.ORG
    });

    studentRepos = orgRepos.data
        .filter(r => { return r.name.includes(process.env.REPO_PATTERN) })
        .map(function(repo) {
            return repo.name;
        }
    );
    
    console.log("These repos are going to be initialized: ", studentRepos);

    const start = async () => {
        await asyncForEach(studentRepos, async (repoName) => {

            console.log("Initializing: ", repoName);

            initData.project.response = await octokit.projects.createForRepo({
                owner: process.env.ORG,
                repo: repoName,
                name: initData.project.name,
                body: initData.project.body
            });
    
            initData.project.columns.toDo.response = await octokit.projects.createColumn({
                project_id: initData.project.response.data.id,
                name: "To do"
            });
    
            initData.project.columns.inProgress.response = await octokit.projects.createColumn({
                project_id: initData.project.response.data.id,
                name: "In progress"
            });
    
            initData.project.columns.done.response = await octokit.projects.createColumn({
                project_id: initData.project.response.data.id,
                name: "Done"
            });
    
            var promisesMilestones = await initData.milestones.map( async (milestone) => {
                milestone.response = await octokit.issues.createMilestone({
                    owner: process.env.ORG,
                    repo: repoName,
                    title: milestone.title,
                    state: 'open',
                    due_on: milestone.due_on
                });
                return milestone;
            });
            initData.milestones = await Promise.all(promisesMilestones);
    
            var promisesLabels = await initData.labels.map( async (label) => {
                label.response = await octokit.issues.createLabel({
                    owner: process.env.ORG,
                    repo: repoName,
                    name: label.name,
                    color: label.color,
                    description: label.description
                });
                return label;
            });
            initData.labels = await Promise.all(promisesLabels);
    
            var promisesIssues = await initData.issues.map( async (issue) => {
                var currentMilestone = initData.milestones.filter( milestone => milestone.title == issue.milestone);
                issue.response = await octokit.issues.create({
                    owner: process.env.ORG,
                    repo: repoName,
                    title: issue.title,
                    body: issue.body,
                    milestone: currentMilestone[0].response.data.number,
                    labels: issue.labels
                });
                return issue;
            });
            initData.issues = await Promise.all(promisesIssues);
    
            var promisesCard = await initData.issues.map( async (issue) => {
                issue.card.response = await octokit.projects.createCard({
                    column_id: initData.project.columns.toDo.response.data.id,
                    content_id: issue.response.data.id,
                    content_type: "Issue"
                });
                return issue;
            });
            initData.issues = await Promise.all(promisesCard);
        });
        console.log('Done!');
    }
    
    start();
})();

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}