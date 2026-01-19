#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import pc from 'picocolors';
import { glob } from 'glob';
import Mustache from 'mustache';
import logSymbols from 'log-symbols';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = {
  info: (msg) => console.log(`${pc.cyan(logSymbols.info)} ${msg}`),
  success: (msg) => console.log(`${pc.green(logSymbols.success)} ${msg}`),
  error: (msg) => console.log(`${pc.red(logSymbols.error)} ${msg}`),
  warn: (msg) => console.log(`${pc.yellow(logSymbols.warning)} ${msg}`),
};

/**
 * Copy files using glob patterns
 */
async function copyFiles(srcDir, destDir, pattern = '**/*') {
  await fs.mkdir(destDir, { recursive: true });

  const files = await glob(pattern, {
    cwd: srcDir,
    nodir: true,
    dot: true,
    absolute: false,
  });

  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);

    // Create destination directory if needed
    await fs.mkdir(path.dirname(destPath), { recursive: true });

    // Copy file
    await fs.copyFile(srcPath, destPath);

    // Log copied file
    console.log(`  ${pc.dim('→')} ${file}`);
  }
}

/**
 * Check if directory exists and is empty
 */
async function isDirEmpty(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    return files.length === 0;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return true; // Directory doesn't exist, treat as empty
    }
    throw error;
  }
}

/**
 * Run npm install
 */
function runNpmInstall(projectPath) {
  return new Promise((resolve, reject) => {
    log.info('Installing dependencies...');

    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const install = spawn(npm, ['install'], {
      cwd: projectPath,
      stdio: 'inherit',
      shell: true,
    });

    install.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`npm install exited with code ${code}`));
        return;
      }
      resolve();
    });

    install.on('error', reject);
  });
}

/**
 * Load and render template file
 */
async function renderTemplate(templatePath, data) {
  const template = await fs.readFile(templatePath, 'utf-8');
  return Mustache.render(template, data);
}

/**
 * Main function
 */
async function main() {
  console.log();
  console.log(`${pc.bold(pc.blue('🧿 Backtest Kit'))}`);
  console.log();

  // Get project name from arguments
  const args = process.argv.slice(2);
  const projectName = args[0] || 'my-backtest-project';

  const projectPath = path.resolve(process.cwd(), projectName);
  const srcTemplatePath = path.resolve(__dirname, '..', 'src');
  const templateDir = path.resolve(__dirname, '..', 'template');

  // Template data for Mustache
  const templateData = {
    PROJECT_NAME: projectName,
  };

  try {
    // Check if directory exists and is not empty
    {
      const isEmpty = await isDirEmpty(projectPath);
      if (!isEmpty) {
        log.error(`Directory ${projectName} already exists and is not empty.`);
        process.exit(1);
      }
    }

    {
      log.info(`Creating a new Backtest Kit project in ${pc.bold(projectPath)}`);
      console.log();
    }

    // Create project directory
    {
      await fs.mkdir(projectPath, { recursive: true });
      log.success('Created project directory');
    }

    // Copy source template files using glob
    {
      log.info('Copying template files...');
      await copyFiles(srcTemplatePath, path.join(projectPath, 'src'));
      log.success('Copied template files');
    }

    // Create types/types.d.ts from template
    {
      log.info('Creating types/types.d.ts...');
      await fs.mkdir(path.join(projectPath, 'types'), { recursive: true });
      const typesContent = await renderTemplate(
        path.join(templateDir, 'types.mustache'),
        templateData
      );
      await fs.writeFile(
        path.join(projectPath, 'types', 'types.d.ts'),
        typesContent,
        'utf-8'
      );
      log.success('Created types/types.d.ts');
    }

    // Create package.json from template
    {
      log.info('Creating package.json...');
      const packageJsonContent = await renderTemplate(
        path.join(templateDir, 'package.mustache'),
        templateData
      );
      await fs.writeFile(
        path.join(projectPath, 'package.json'),
        packageJsonContent,
        'utf-8'
      );
      log.success('Created package.json');
    }

    // Create .env files from template
    {
      log.info('Creating .env template...');
      const envContent = await renderTemplate(
        path.join(templateDir, 'env.mustache'),
        templateData
      );
      await fs.writeFile(
        path.join(projectPath, '.env.example'),
        envContent,
        'utf-8'
      );
      await fs.writeFile(
        path.join(projectPath, '.env'),
        envContent,
        'utf-8'
      );
      log.success('Created .env files');
    }

    // Create .gitignore from template
    {
      log.info('Creating .gitignore...');
      const gitignoreContent = await renderTemplate(
        path.join(templateDir, 'gitignore.mustache'),
        templateData
      );
      await fs.writeFile(
        path.join(projectPath, '.gitignore'),
        gitignoreContent,
        'utf-8'
      );
      log.success('Created .gitignore');
    }

    // Create README.md from template
    {
      log.info('Creating README.md...');
      const readmeContent = await renderTemplate(
        path.join(templateDir, 'README.mustache'),
        templateData
      );
      await fs.writeFile(
        path.join(projectPath, 'README.md'),
        readmeContent,
        'utf-8'
      );
      log.success('Created README.md');
      console.log();
    }

    // Create jsconfig.json from template
    {
      log.info('Creating jsconfig.json...');
      const jsconfigContent = await renderTemplate(
        path.join(templateDir, 'jsconfig.json.mustache'),
        templateData
      );
      await fs.writeFile(
        path.join(projectPath, 'jsconfig.json'),
        jsconfigContent,
        'utf-8'
      );
      log.success('Created jsconfig.json');
    }

    // Create config directory and ecosystem.config.cjs from template
    {
      log.info('Creating ecosystem.config.cjs...');
      await fs.mkdir(path.join(projectPath, 'config'), { recursive: true });
      const ecosystemContent = await renderTemplate(
        path.join(templateDir, 'ecosystem.mustache'),
        templateData
      );
      await fs.writeFile(
        path.join(projectPath, 'config', 'ecosystem.config.cjs'),
        ecosystemContent,
        'utf-8'
      );
      log.success('Created ecosystem.config.cjs');
    }

    // Create config/prompt/signal.prompt.cjs from template
    {
      log.info('Creating config/prompt/signal.prompt.cjs...');
      await fs.mkdir(path.join(projectPath, 'config', 'prompt'), { recursive: true });
      const signalPromptContent = await renderTemplate(
        path.join(templateDir, 'signal_prompt.mustache'),
        templateData
      );
      await fs.writeFile(
        path.join(projectPath, 'config', 'prompt', 'signal.prompt.cjs'),
        signalPromptContent,
        'utf-8'
      );
      log.success('Created config/prompt/signal.prompt.cjs');
    }

    // Create config/docker/docker-compose.yaml from template
    {
      log.info('Creating config/docker/docker-compose.yaml...');
      await fs.mkdir(path.join(projectPath, 'config', 'docker'), { recursive: true });
      const dockerComposeContent = await renderTemplate(
        path.join(templateDir, 'docker-compose.mustache'),
        templateData
      );
      await fs.writeFile(
        path.join(projectPath, 'config', 'docker', 'docker-compose.yaml'),
        dockerComposeContent,
        'utf-8'
      );
      log.success('Created config/docker/docker-compose.yaml');
    }

    // Create index.cjs from template
    {
      log.info('Creating index.cjs...');
      const indexContent = await renderTemplate(
        path.join(templateDir, 'index.mustache'),
        templateData
      );
      await fs.writeFile(
        path.join(projectPath, 'index.cjs'),
        indexContent,
        'utf-8'
      );
      log.success('Created index.cjs');
    }

    // Create Dockerfile from template
    {
      log.info('Creating Dockerfile...');
      const dockerfileContent = await renderTemplate(
        path.join(templateDir, 'Dockerfile.mustache'),
        templateData
      );
      await fs.writeFile(
        path.join(projectPath, 'Dockerfile'),
        dockerfileContent,
        'utf-8'
      );
      log.success('Created Dockerfile');
    }

    // Create scripts/linux/publish.sh from template
    {
      log.info('Creating scripts/linux/publish.sh...');
      await fs.mkdir(path.join(projectPath, 'scripts', 'linux'), { recursive: true });
      const publishShContent = await renderTemplate(
        path.join(templateDir, 'publish_sh.mustache'),
        templateData
      );
      await fs.writeFile(
        path.join(projectPath, 'scripts', 'linux', 'publish.sh'),
        publishShContent,
        'utf-8'
      );
      // Make the script executable on Unix-like systems
      try {
        await fs.chmod(path.join(projectPath, 'scripts', 'linux', 'publish.sh'), 0o755);
      } catch (err) {
        // Ignore chmod errors on Windows
      }
      log.success('Created scripts/linux/publish.sh');
    }

    // Create scripts/win/publish.bat from template
    {
      log.info('Creating scripts/win/publish.bat...');
      await fs.mkdir(path.join(projectPath, 'scripts', 'win'), { recursive: true });
      const publishBatContent = await renderTemplate(
        path.join(templateDir, 'publish_bat.mustache'),
        templateData
      );
      await fs.writeFile(
        path.join(projectPath, 'scripts', 'win', 'publish.bat'),
        publishBatContent,
        'utf-8'
      );
      log.success('Created scripts/win/publish.bat');
    }

    // Install dependencies
    {
      await runNpmInstall(projectPath);
      console.log();
      log.success('Installation complete!');
      console.log();
    }

    // Display success message with instructions
    {
      console.log(`${pc.bold('Success!')} Created ${pc.cyan(projectName)} at ${pc.bold(projectPath)}`);
      console.log();
      console.log('Inside that directory, you can run several commands:');
      console.log();
      console.log(`  ${pc.cyan('npm start')}`);
      console.log('    Starts the trading bot.');
      console.log();
      console.log('We suggest that you begin by typing:');
      console.log();
      console.log(`  ${pc.cyan(`cd ${projectName}`)}`);
      console.log(`  ${pc.cyan('npm start')}`);
      console.log();
      console.log(`${pc.yellow('Don\'t forget to configure your API keys in .env file!')}`);
      console.log();
      console.log('Happy trading! 🚀');
      console.log();
    }

  } catch (error) {
    log.error('Failed to create project:');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
