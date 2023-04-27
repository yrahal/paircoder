const EventEmitter = require('events');
const spawn = require('child_process').spawn;

const vscode = require('vscode');

const axios = require('axios');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const serverContainerName = 'paircoder-server';

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('Extension "paircoder" is now active');

	let disposableStart = vscode.commands.registerCommand('paircoder.docker.start', async function () {
		console.log('Starting LLM server container...');
		vscode.window.showInformationMessage('Starting LLM server container...');

		const config = vscode.workspace.getConfiguration('paircoder');

		const env = !!config.model.filename ? ['-e', `MODEL=${config.model.filename}`] : [];
		const cmd = ['run', '--rm', '--name', serverContainerName, '-v', `${config.model.modelsPath}:/models`, '-p', `${config.docker.port}:80`].concat(env).concat([config.docker.image]);
		console.log(cmd);

		const dockerStartCmd = spawn('docker', cmd);

		dockerStartCmd.stdout.on('data', (data) => {
			console.log(data.toString());
		});

		dockerStartCmd.stderr.on('data', (data) => {
			console.error(data.toString());
		});

		dockerStartCmd.on('spawn', () => {
			console.log('LLM server container spawned');
			vscode.window.showInformationMessage('Started LLM server container');
		});

		dockerStartCmd.on('error', (error) => {
			console.error(error);
		});

		dockerStartCmd.on('close', (code) => {
			if (code != 0) {
				vscode.window.showErrorMessage(`LLM server container exited with code ${code}`);
			}

			console.log(`LLM server container exited with code ${code}`);
		});

		console.log('Submitted start LLM server container request.');
	});

	let disposableStop = vscode.commands.registerCommand('paircoder.docker.stop', async function () {
		console.log('Stopping LLM server container...');
		vscode.window.showInformationMessage('Stopping LLM server container...');

		const dockerStopCmd = spawn('docker', ['stop', serverContainerName]);

		dockerStopCmd.stdout.on('data', (data) => {
			console.log(data.toString());
		});

		dockerStopCmd.stderr.on('data', (data) => {
			console.error(data.toString());
		});

		dockerStopCmd.on('error', (error) => {
			console.error(error);
		});

		dockerStopCmd.on('close', (code) => {
			console.log(`Stopped LLM server container with code ${code}`);

			if (code != 0) {
				vscode.window.showErrorMessage(`Failed to stop LLM server container with code ${code}`);
			} else {
				vscode.window.showInformationMessage('Stopped LLM server container');
			}
		});

		console.log('Submitted stop LLM server container request.');
	});

	let disposablePairCode = vscode.commands.registerCommand('paircoder.paircode', async function () {
		console.log('Paircoding...');
		
		const config = vscode.workspace.getConfiguration('paircoder');
		const url = config.server.url;
		console.info(`Predicting using url='${url}'`);

		const eventEmitter = new EventEmitter();

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			cancellable: false,
			title: 'PairCoding...',
		}, async (progress) => {
			progress.report({ increment: 0 });
			await new Promise(resolve => eventEmitter.once('unlock', resolve));
			progress.report({ increment: 100 });
		});


		const editor = vscode.window.activeTextEditor;
		let highlight = editor.document.getText(editor.selection);

		let streaming = true;
		let prediction = '';
		let charIndex = 0;

		const response = await axios({
			method: 'POST',
			url: url,
			responseType: 'stream',
			data: { prompt: highlight, clip_prompt: true },
		})
			.catch((error) => {
				console.error(error);
			});

		if (!response) {
			eventEmitter.emit('unlock');
			vscode.window.showErrorMessage('PairCoding failed');
			return;
		}

		console.log('Starting to stream prediction...');

		const stream = response.data;
		const decooder = new TextDecoder();

		stream.on('data', (data) => {
			prediction += decooder.decode(data);
		});

		stream.on('end', () => {
			console.log('Received end of prediction stream.');
			streaming = false;
		});

		stream.on('error', (error) => {
			console.error(error);
			streaming = false;
			vscode.window.showErrorMessage('PairCoding failed');
		});

		while (streaming || charIndex < prediction.length) {
			if (charIndex < prediction.length) {
				editor.edit(editBuilder => {
					let charToInsert = prediction.charAt(charIndex);

					editBuilder.insert(editor.selection.end, charToInsert);
				}).then((success) => {
					if (success) {
						charIndex += 1;
					} else {
						console.warn('Unable to insert. Retrying... i =', charIndex);
					}
				});
			}

			await sleep(33);
		}

		eventEmitter.emit('unlock');

		console.log('Paircoding completed.');
	});

	context.subscriptions.push(disposableStart);
	context.subscriptions.push(disposableStop);
	context.subscriptions.push(disposablePairCode);
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
}
