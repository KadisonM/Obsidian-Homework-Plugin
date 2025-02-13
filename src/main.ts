import { Plugin } from 'obsidian';
import { SettingsTab, defaultLogo } from "./settings";
import { HomeworkManagerData } from './data-editor';
import DataEditor from './data-editor';
import UpdateModal from './modals/update-modal';

import HomeworkModal from './modals/homework-modal'

export default class HomeworkManagerPlugin extends Plugin {
	data: HomeworkManagerData;
	dataEditor: DataEditor;

	async onload() {
		await this.fetchData();

		this.addSettingTab(new SettingsTab(this.app, this));

		// Open homework ribbon button
		const ribbonToggle = this.addRibbonIcon(defaultLogo, 'Open homework', (evt: MouseEvent) => {
			new HomeworkModal(this.app, this).open();
		});

		// Perform additional things with the ribbon
		ribbonToggle.addClass('my-plugin-ribbon-class');

		// Open homework command
		this.addCommand({
			id: 'open-homework',
			name: 'Open homework',
			callback: () => {
				new HomeworkModal(this.app, this).open();
			}
		});

		this.addCommand({
			id: 'open-update-notes',
			name: 'Open update notes',
			callback: () => {
				new UpdateModal(this.app, this).open();
			}
		});

		if (await this.dataEditor.checkPluginUpdated()) {
			new UpdateModal(this.app, this).open();
		}
	}

	async onunload() {
		await this.writeData();
	}

	async fetchData() {
		this.dataEditor = new DataEditor(this);

		const foundData = Object.assign({}, await this.loadData());
		
		let newData = foundData;

		// Legacy data -> needs to convert
        if (foundData.views === undefined) {
            newData = this.dataEditor.convertFromLegacy(foundData);
        }

		newData = this.dataEditor.formatData(newData);

		this.data = newData;
		await this.writeData();
	}

	async writeData() {
		await this.saveData(this.data);
	}
}