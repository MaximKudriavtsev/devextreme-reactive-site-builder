const INDEX_FILE = 'index.html';
const { join } = require('path');
const { removeSync, readdirSync, readFileSync, writeFileSync, existsSync, copySync } = require('fs-extra');

const changeFileContent = (string, findString) => {
  const contentLines = String(readFileSync(join('./', INDEX_FILE))).split('\n');
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
  console.log(nextSource);
  
  writeFileSync(
    join('./', INDEX_FILE),
    nextSource,
    'utf-8',
  );
};

const createFile = () => {
  writeFileSync(
    join('./name', 'INDEX_FILE.js'),
    1233,
    'utf-8',
  );
}

// changeFileContent('<a id="pr-XXX" href="pr-XXX"></a>', 'pr-XXX');
createFile();