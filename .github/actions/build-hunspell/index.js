const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');
const tc = require('@actions/tool-cache');

function getUrl(version) {
	const parts = version.split('.');
	const major = parts.length > 0 ? parseInt(parts[0]) : 0;
	const minor = parts.length > 1 ? parseInt(parts[1]) : 0;
	const patch = parts.length > 2 ? parseInt(parts[2]) : 0;

	// Hunspell <= 1.3.3 are on SourceForge, later versions are on GitHub
	if (major === 1 && (minor < 3 || (minor == 3 && patch <= 3))) {
		return `https://downloads.sourceforge.net/project/hunspell/Hunspell/${version}/hunspell-${version}.tar.gz`;
	} else {
		return `https://github.com/hunspell/hunspell/archive/v${version}.tar.gz`
	}
}

async function extract(archivePath) {
	if (process.platform === 'win32') {
		const tempDirectory = process.env['RUNNER_TEMP'] + 'hunspell';
		await io.mkdirP(tempDirectory);
		await io.cp(archivePath, tempDirectory + '/archive.tar.gz')
//		await exec.exec('msys2do', ['tar', '-xvf', archivePath.replace(/\\/g, '/').replace(/^([a-zA-Z]):/, '/$1')], {'cwd': tempDirectory});
		await exec.exec('7z', ['x', 'archive.tar.gz'], {'cwd': tempDirectory})
		await exec.exec('7z', ['x', 'archive.tar'], {'cwd': tempDirectory})
		return tempDirectory;
//		return await tc.extract7z(archivePath);
	}
	else {
		return await tc.extractTar(archivePath);
	}
}

async function runCmd(cmd, args, opts) {
	if (process.platform === 'win32') {
		return await exec.exec('msys2do', [cmd].concat(args), opts);
	} else {
		return await exec.exec(cmd, args, opts);
	}
}

async function run() {
	try {
		const version = core.getInput('version');
		const url = getUrl(version);
		const makeCmd = function() {
			switch (process.platform) {
				case 'win32':
					return 'mingw64-make';
				default:
					return 'make';
			}
		}();

		if (core.getInput('install-deps') === 'true') {
			core.startGroup('Installing dependencies');
			switch (process.platform) {
				case 'linux':
					break;
				case 'darwin':
					await runCmd('brew', ['install', 'autoconf', 'automake', 'libtool']);
					break;
				case 'win32':
					await runCmd('pacman', ['--noconfirm', '-S', 'autoconf', 'automake-wrapper', 'libtool', 'mingw-w64-x86_64-make', 'mingw-w64-x86_64-gcc'])
					break;
				default:
					break;
			}
			core.endGroup('Installing dependencies');
		}

		console.log(`Downloading hunspell from ${url}`);

		const archivePath = await tc.downloadTool(url);

		core.startGroup('Extracting sources');
		const folder = await extract(archivePath) + `/hunspell-${version}`;
		core.endGroup();

		core.startGroup('Running autoreconf');
		await runCmd('autoreconf', ['-vfi'], {cwd: folder});
		core.endGroup();

		core.startGroup('Configure');
		await runCmd('./configure', ['--disable-dependency-tracking'], {cwd: folder});
		core.endGroup();

		core.startGroup('Build');
		await runCmd(makeCmd, ['-j'], {cwd: folder});
		core.endGroup();

		if (core.getInput('install') === 'true') {
			core.startGroup('Install');
			if (process.platform === 'linux') {
				await runCmd('sudo', ['make', 'install'], {cwd: folder});
			} else {
				await runCmd('make', ['install'], {cwd: folder});
			}
			core.endGroup();
		}
	} catch(error) {
		core.setFailed(error.message);
	}
}

run();
