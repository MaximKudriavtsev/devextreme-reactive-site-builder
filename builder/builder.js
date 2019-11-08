const { join } = require('path');
const { removeSync, readdirSync, readFileSync, writeFileSync, existsSync, copySync } = require('fs-extra');
const { execSync } = require('child_process');
const Octokit = require("@octokit/rest");
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  userAgent: process.env.USER,
});

const REPO_WITH_OWNER = 'devexpress/devextreme-reactive';
const OWNER = 'devexpress';
const REPO = 'devextreme-reactive';
const REACT_GRID = 'react/grid/';
const REPO_FOLDER = 'repo';
const SITE_FOLDER = 'repo/site';
const BUILT_SITE_FOLDER = '/site-data';
const GENERATED_CONFIG_FILE = '_config.g.yml';
const META_FILE = 'meta.json';
const INDEX_FILE = 'index.html';
const STYLES_FILE = 'styles.css';
const formatterOptions = {
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric',
  timeZone: "Europe/Moscow",
};
const prevPRs = [];
const STYLES = `
h1 {
  color: #424242;
  padding-bottom: 3%;
}
body {
  padding: 2% 20%;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}
a {
  color: inherit;
  text-decoration: none;
}
span {
  display: block;
  margin-top: 10px;
  padding: 5px 8px;
  border-radius: 5px;
  border: 1px;
}
.done {
  background-color: #C8E6C9;
}
.failure {
  background-color: #FFCDD2;
}
.progress {
  background-color: #FFECB3;
}
`;

const sleep = (time) => new Promise(resolve => setTimeout(resolve, time));
const changeFileContent = (string, findString) => {
  const contentLines = String(readFileSync(join(BUILT_SITE_FOLDER, INDEX_FILE))).split('\n');
  let isExists = false;

  const source = contentLines.reduce((acc, line) => {
    if (line.indexOf(findString) > -1) {
      isExists = true;
      return [...acc, string];
    } else {
      return [...acc, line];
    }
  }, []);
  const nextSource = (isExists ? source : [...source, string]).join('\n');
  
  writeFileSync(
    join(BUILT_SITE_FOLDER, INDEX_FILE),
    nextSource,
    'utf-8',
  );
};

const removeOldPRs = (prs, oldPRs) => {
  const olds = oldPRs.reduce((acc, oldPr) => {
    if (!prs.some(pr => pr.name === oldPr.name)) {
      return [...acc, oldPr];
    } return acc;
  }, []);

  olds.forEach(old => {
    changeFileContent('', `id="${old.name}"`);
  });
};

const buildSite = async (repository, sha, name, title) => {
  let meta = '';
  try {
    meta = JSON.parse(readFileSync(join(BUILT_SITE_FOLDER, name, META_FILE), 'utf-8'));
  } catch(e) {}
  if (meta === sha) {
    changeFileContent(`<a id="${name}" href="${name}/${REACT_GRID}"><span class="done">${title}</span></a>`, `id="${name}"`);
    return;
  }

  try {
    writeFileSync(
      join(BUILT_SITE_FOLDER, name, META_FILE),
      JSON.stringify(sha),
      'utf-8',
    );

    changeFileContent(`<span id="${name}" class="progress" >${title} [BUILDING...]</span>`, `id="${name}"`);

    removeSync(join(__dirname, REPO_FOLDER));
    execSync(`git clone https://github.com/${repository}.git ${REPO_FOLDER}`, { stdio: 'ignore' });
    execSync(`git checkout ${sha}`, { cwd: join(__dirname, REPO_FOLDER), stdio: 'ignore' });
    
    execSync(`yarn --no-progress`, { cwd: join(__dirname, REPO_FOLDER), stdio: 'ignore' });
    removeSync(join(BUILT_SITE_FOLDER, name));
    if (existsSync(join(REPO_FOLDER, 'packages/dx-site'))) {
      const config = String(readFileSync(join(REPO_FOLDER, 'packages/dx-site/gatsby-config.js')));
      writeFileSync(join(REPO_FOLDER, 'packages/dx-site/gatsby-config.js'), config.replace('pathPrefix: \'/devextreme-reactive\'', `pathPrefix: \'/${name}\'`));
      execSync(`yarn build:site`, { cwd: join(__dirname, REPO_FOLDER), stdio: 'ignore' });
      copySync(join(REPO_FOLDER, 'packages/dx-site/public'), join(BUILT_SITE_FOLDER, name));
    } else {
      execSync(`yarn build:site`, { cwd: join(__dirname, REPO_FOLDER), stdio: 'ignore' });
      execSync('bundle install', { cwd: join(__dirname, SITE_FOLDER) });
      writeFileSync(join(__dirname, SITE_FOLDER, GENERATED_CONFIG_FILE), `baseurl: "/${name}"`);
      execSync(
        `bundle exec jekyll build --config _config.yml,${GENERATED_CONFIG_FILE} --source ${join(__dirname, SITE_FOLDER)} --destination ${join(BUILT_SITE_FOLDER, name)}`,
        { cwd: join(__dirname, SITE_FOLDER), stdio: 'ignore' },
      );
    }
    changeFileContent(`<a id="${name}" href="${name}/${REACT_GRID}"><span class="done">${title}</span></a>`, `id="${name}"`);
  } catch(e) {
    changeFileContent(`<span class="failure" id="${name}" >${title} [BUILD FAILED]</span>`, `id="${name}"`);
  }
};

const script = async () => {
  try {
    writeFileSync(join(BUILT_SITE_FOLDER, INDEX_FILE), '<head><link rel="stylesheet" href="./styles.css"></head><h1>DevExtreme Reactive Continuous PRs Deployment</h1>', 'utf-8');
    writeFileSync(join(BUILT_SITE_FOLDER, STYLES_FILE), `${STYLES}`, 'utf-8');
    while(true) {
      changeFileContent(`<b>Build loop time: ${new Intl.DateTimeFormat('ru-RU', formatterOptions).format(new Date())}</b><br/>`, '<b>Build loop time:');

      const branches = (await octokit.repos.listBranches({
        owner: OWNER,
        repo: REPO,
      })).data.filter(branch => branch.name === 'master');

      const prs = (await octokit.pulls.list({
        owner: OWNER,
        repo: REPO,
      })).data;

      readdirSync(BUILT_SITE_FOLDER).forEach(filename => {
        if (filename.startsWith('pr')) {
          const prNumber = JSON.parse(filename.replace('pr', ''));
          if (prs.findIndex(pr => pr.number === prNumber) === -1) {
            removeSync(join(BUILT_SITE_FOLDER, filename))
          }
        }
        if (filename.startsWith('branch')) {
          const branchName = filename.replace('branch', '');
          if (branches.findIndex(branch => branch.name === branchName) === -1) {
            removeSync(join(BUILT_SITE_FOLDER, filename))
          }
        }
      });

      changeFileContent(`<br/><b>Branches:</b><br/>`, `<br/><b>Branches:</b><br/>`);
      branches.forEach(async branch => {
        await buildSite(REPO_WITH_OWNER, branch.commit.sha, `branch${branch.name}`, branch.name);
      });
      changeFileContent(`<br/><b>PRs:</b><br/>`, `<br/><b>PRs:</b><br/>`);
      prs.forEach(async pr => {
        await buildSite(pr.head.repo.full_name, pr.head.sha, `pr${pr.number}`, pr.title);
      });

      await sleep(3 * 60 * 1000);
    }
  } catch (e) {
    console.log(e);
    changeFileContent(`
      <span id="error" >${e}</span>
    `, 'id="error');
    process.exit(-1);
  }
};

script();