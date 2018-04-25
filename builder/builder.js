const request = require('request-promise-native');
const { join } = require('path');
const { removeSync, readdirSync, readFileSync, writeFileSync } = require('fs-extra');
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

const script = async () => {
  while(true) {
    writeFileSync(join(BUILT_SITE_FOLDER, INDEX_FILE), '', 'utf-8');
    const formatterOptions = {
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      timeZone: "Europe/Moscow",
    };
    appendToIndexFile(`<b>Build time: ${new Intl.DateTimeFormat('en-US', formatterOptions).format(new Date())}</b><br/><br/>`);

    appendToIndexFile(`<b>PRs:</b><br/>`);
    console.log('Check for pr updates...');
    const prs = JSON.parse(await request(`https://api.github.com/repos/${REPO}/pulls`, {
        auth: {
          user: process.env.USER,
          pass: process.env.PASS,
        },
        headers: {
          'User-Agent': 'request',
        },
      }));

    console.log(`Removing stale sites...`);
    readdirSync(BUILT_SITE_FOLDER).forEach(filename => {
      if (!filename.startsWith('pr')) return;
      const prNumber = JSON.parse(filename.replace('pr', ''));
      if (prs.findIndex(pr => pr.number === prNumber) === -1) {
        removeSync(join(BUILT_SITE_FOLDER, filename))
      }
    });

    console.log(`Generating sites...`);
    prs.forEach(async pr => {
      let meta = '';
      try {
        meta = JSON.parse(readFileSync(join(BUILT_SITE_FOLDER, `pr${pr.number}`, META_FILE), 'utf-8'));
      } catch(e) {}
      if (meta === pr.head.sha) {
        appendToIndexFile(`<a href="pr${pr.number}/">${pr.title}</a><br />`);
        return;
      }

      console.log(`Building site for: pr${pr.number}...`);
      try {
        removeSync(join(__dirname, REPO_FOLDER));
        execSync(`git clone https://github.com/${pr.head.repo.full_name}.git ${REPO_FOLDER}`, { stdio: 'ignore' });
        execSync(`git checkout ${pr.head.sha}`, { cwd: join(__dirname, REPO_FOLDER), stdio: 'ignore' });
        
        removeSync(join(BUILT_SITE_FOLDER, `pr${pr.number}`));
        execSync(`yarn --no-progress`, { cwd: join(__dirname, REPO_FOLDER), stdio: 'ignore' });
        execSync(`yarn build:site`, { cwd: join(__dirname, REPO_FOLDER), stdio: 'ignore' });
        execSync('bundle install', { cwd: join(__dirname, SITE_FOLDER) });
        writeFileSync(join(__dirname, SITE_FOLDER, GENERATED_CONFIG_FILE), `baseurl: "/pr${pr.number}"`);
        execSync(
          `bundle exec jekyll build --config _config.yml,${GENERATED_CONFIG_FILE} --source ${join(__dirname, SITE_FOLDER)} --destination ${join(BUILT_SITE_FOLDER, `pr${pr.number}`)}`,
          { cwd: join(__dirname, SITE_FOLDER), stdio: 'ignore' },
        );
        writeFileSync(
          join(BUILT_SITE_FOLDER, `pr${pr.number}`, META_FILE),
          JSON.stringify(pr.head.sha),
          'utf-8',
        );
        appendToIndexFile(`<a href="pr${pr.number}/">${pr.title}</a><br />`);
      } catch(e) {
        appendToIndexFile(`<span>${pr.title} [BUILD FAILED]</span><br />`);
      }
    });

    await sleep(3 * 60 * 1000);
  }
};

script();