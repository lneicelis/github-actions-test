async function getReferencedEpics({ context, github, epicLabelName }) {
  if (context.payload.action !== 'deleted') {
    const events = await github.issues.listEventsForTimeline({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.payload.issue.number,
    });

    return events.data
      .filter((item) => (item.event === 'cross-referenced' && item.source))
      .filter((item) => item.source.issue.labels
        .filter((label) => label.name.toLowerCase() === epicLabelName.toLowerCase()).length > 0);
  }

  return [];
}

async function updateEpic({ context, github, epic }) {
  const autoCloseEpic = false;

  const issueNumber = context.payload.issue.number;
  const issueState = context.payload.issue.state;
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

  const result = await github.issues.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: epicNumber,
    body: epicBody,
    state: epicState,
  });

  return result;
}

async function updateEpics({ context, github, epics }) {
  return Promise.all(epics.map((epic) => updateEpic({ context, github, epic })));
}

module.exports = async function ({context, github, core}) {
  console.log('hello');
  
  try {
    const token = core.getInput('github-token', { required: true });
    const epics = await getReferencedEpics({ context, github, epicLabelName: 'epic' });
    await updateEpics({ context, github, epics });
  } catch (error) {
    core.error(error);
    core.setFailed(error.message);
  }
}
