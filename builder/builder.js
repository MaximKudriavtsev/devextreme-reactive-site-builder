const request = require('request-promise-native');
const { join } = require('path');
const { removeSync, readdirSync, readFileSync, writeFileSync, existsSync, copySync } = require('fs-extra');
const { execSync } = require('child_process');

const REPO = 'devexpress/DevExtreme-Reactive';
const REPO_FOLDER = 'repo';
const SITE_FOLDER = 'repo/site';
const BUILT_SITE_FOLDER = '/site-data';
const GENERATED_CONFIG_FILE = '_config.g.yml';
const META_FILE = 'meta.json';
const INDEX_FILE = 'index.html';

const sleep = (time) => new Promise(resolve => setTimeout(resolve, time));
const appendToIndexFile = (string) => {
  const content = String(readFileSync(join(BUILT_SITE_FOLDER, INDEX_FILE)));
  writeFileSync(
    join(BUILT_SITE_FOLDER, INDEX_FILE),
    `${content}\n${string}`,
    'utf-8',
  );
};
const buildSite = async (repository, sha, name, title) => {
  let meta = '';
  try {
    meta = JSON.parse(readFileSync(join(BUILT_SITE_FOLDER, name, META_FILE), 'utf-8'));
  } catch(e) {}
  if (meta === sha) {
    appendToIndexFile(`<a href="${name}/">${title}</a><br />`);
    return;
  }

  try {
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
    writeFileSync(
      join(BUILT_SITE_FOLDER, name, META_FILE),
      JSON.stringify(sha),
      'utf-8',
    );
    appendToIndexFile(`<a href="${name}/">${title}</a><br />`);
  } catch(e) {
    appendToIndexFile(`<span>${title} [BUILD FAILED]</span><br />`);
  }
};

const script = async () => {
  try {
    while(true) {
      writeFileSync(join(BUILT_SITE_FOLDER, INDEX_FILE), '', 'utf-8');
      const formatterOptions = {
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        timeZone: "Europe/Moscow",
      };
      appendToIndexFile(`<b>Build time: ${new Intl.DateTimeFormat('en-US', formatterOptions).format(new Date())}</b><br/>`);

      const branches = JSON.parse(await request(`https://api.github.com/repos/${REPO}/branches`, {
          auth: {
            user: process.env.USER,
            pass: process.env.PASS,
          },
          headers: {
            'User-Agent': 'request',
          },
        }))
        .filter(branch => branch.name !== 'gh-pages');

      const prs = JSON.parse(await request(`https://api.github.com/repos/${REPO}/pulls`, {
          auth: {
            user: process.env.USER,
            pass: process.env.PASS,
          },
          headers: {
            'User-Agent': 'request',
          },
        }));

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

      appendToIndexFile(`<br/><b>Branches:</b><br/>`);
      branches.forEach(async branch => {
        await buildSite(REPO, branch.commit.sha, `branch${branch.name}`, branch.name);
      });
      appendToIndexFile(`<br/><b>PRs:</b><br/>`);
      prs.forEach(async pr => {
        await buildSite(pr.head.repo.full_name, pr.head.sha, `pr${pr.number}`, pr.title);
      });

      await sleep(3 * 60 * 1000);
    }
  } catch (e) {
    process.exit(-1);
  }
};

script();