async function getReferencedEpics({ github, octokit, epicLabelName }) {
  if (github.context.payload.action !== 'deleted') {
    const events = await octokit.issues.listEventsForTimeline({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: github.context.payload.issue.number,
    });

    return events.data
      .filter((item) => (item.event === 'cross-referenced' && item.source))
      .filter((item) => item.source.issue.labels
        .filter((label) => label.name.toLowerCase() === epicLabelName.toLowerCase()).length > 0);
  }

  return [];
}

async function updateEpic({ github, octokit, epic }) {
  const autoCloseEpic = false;

  const issueNumber = github.context.payload.issue.number;
  const issueState = github.context.payload.issue.state;
  const convertedIssueState = issueState === 'closed' ? 'x' : ' ';
  const epicNumber = epic.source.issue.number;
  let epicState = epic.source.issue.state;
  let epicBody = epic.source.issue.body;

  const pattern = new RegExp(`- \\[[ |x]\\] .*#${issueNumber}.*`, 'gm');
  const matches = Array.from(epicBody.matchAll(pattern));
  const matchCount = matches.length;

  matches.forEach((match) => {
    epicBody = epicBody.replace(match[0], match[0].replace(/- \[[ |x]\]/, `- [${convertedIssueState}]`));
  });

  const patternAll = new RegExp('- \\[[ |x]\\] .*#.*', 'gm');
  const patternAllDone = new RegExp('- \\[[x]\\] .*#.*', 'gm');
  const matchesAll = Array.from(epicBody.matchAll(patternAll));
  const matchesAllCount = matchesAll.length;
  const matchesAllDone = Array.from(epicBody.matchAll(patternAllDone));
  const matchesAllDoneCount = matchesAllDone.length;

  if (!!autoCloseEpic
    && matchCount
    && matchesAllCount
    && matchesAllDoneCount === matchesAllCount
  ) {
    epicState = 'closed';
  }

  const result = await octokit.issues.update({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: epicNumber,
    body: epicBody,
    state: epicState,
  });

  return result;
}

async function updateEpics({ octokit, epics }) {
  return Promise.all(epics.map((epic) => updateEpic({ octokit, epic })));
}

module.exports = async function ({github, core}) {
  console.log('hello');
  
  try {
    const token = core.getInput('github-token', { required: true });
    const epics = await getReferencedEpics({ octokit, epicLabelName: 'epic' });
    await updateEpics({ octokit, epics });
  } catch (error) {
    core.error(error);
    core.setFailed(error.message);
  }
}
