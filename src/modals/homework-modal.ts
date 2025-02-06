import HomeworkManagerPlugin from '../main';
import { App, Modal, TFile, Notice, setIcon, View } from 'obsidian';
import ViewManagerModal from './view-modal';
import SuggestFileModal from './file-modal';

export default class HomeworkModal extends Modal {
	plugin: HomeworkManagerPlugin;

    divHeader: HTMLDivElement;
    divViewSelector: HTMLDivElement;
    divTopLevel: HTMLDivElement;
    divBody: HTMLDivElement;
    
    editMode: boolean;
    creating: boolean;

	constructor(app: App, plugin: HomeworkManagerPlugin) {
		super(app);
		this.plugin = plugin;
        this.editMode = false;
        this.creating = false;
	}

	async onOpen() {
		const {contentEl} = this;
        await this.plugin.fetchData();

        contentEl.addClass("homework-manager");
        this.divHeader = contentEl.createEl("div", { attr: {"id": "header"}});
        this.divViewSelector = contentEl.createEl("div");
        this.divTopLevel = contentEl.createEl("div", {cls: "homework-manager-hidden"});
        this.divBody = contentEl.createEl("div", { attr: {"id": "body"} });

        await this.changeView(0);
	}

	onClose() {   
		const {contentEl} = this;
		contentEl.empty();
	}

    async changeView(viewIndex: number) {
        if (!this.plugin.data.views[viewIndex]) {
            console.log("Cannot find requested view in data.");
            viewIndex = 0;
        }

        await this.createHeader(viewIndex);

        if (this.editMode) {
            await this.createEditMode(viewIndex);
        } else {
            await this.createReadMode(viewIndex);
        }
    }

    async createHeader(viewIndex: number) {
        // Clear existing header
        this.divHeader.empty();
        this.divViewSelector.empty();

        // ------------------- LEFT HEADER ------------------- //
        const headerLeft = this.divHeader.createEl("div", {attr: {"id": "left-column"}});
        
        const views = this.plugin.data.views;

        if (!this.editMode) {
            const dropdownButton = this.createIconButton(headerLeft, undefined, "chevron-down", {message: "View options"});

            let dropdownList: HTMLDivElement | undefined = undefined;

            dropdownButton.addEventListener("click", (click) => {
                if (dropdownList == undefined) {
                    dropdownList = this.divViewSelector.createEl("div", {cls: "menu mod-tab-list", attr: {"id": "menu"}});

                    // Add button for each view
                    if (views.length > 1) {
                        views.forEach((viewOption, index) => {
                            if (index != viewIndex && dropdownList) {
                                const viewButton = this.createMenuButton(
                                    dropdownList, 
                                    undefined, 
                                    { icon: "layers", text: viewOption.name}, 
                                    {message: "Switch to view", position: "right"});

                                viewButton?.addEventListener("click", (click) => {
                                    this.editMode = false;
                                    this.changeView(index);
                                }); 
                            }
                        });   
                        
                        dropdownList.createEl("div", {cls: "menu-separator"});
                    }
                    
                    // Manage views button
                    const manageButton = this.createMenuButton(
                        dropdownList, 
                        undefined, 
                        { icon: "pencil", text: "Manage views"}, 
                        {message: "Add, delete, sort, or rename your views", position: "right"});

                    manageButton?.addEventListener("click", (click) => {
                        // Open modal
                        this.changeView(viewIndex);
                        let modalManage = new ViewManagerModal(this.app, this.plugin);
						modalManage.onClosing = () => {
							this.changeView(viewIndex);
						};

						modalManage.open();
                    }); 

                    dropdownList.createEl("div", {cls: "menu-separator"});

                    // Add Task Button
                    const taskButton = this.createMenuButton(
                        dropdownList, 
                        undefined, 
                        { icon: "plus", text: "Add task"}, 
                        {message: "Creates a task without a subject", position: "right"});

                    taskButton?.addEventListener("click", async (click) => {
                        dropdownList?.remove();
                        dropdownList = undefined;

                        let viewTasksDiv = this.divBody.getElementsByClassName("homework-manager-view-tasks")[0];

                        if (viewTasksDiv === undefined) {
                            viewTasksDiv = this.divTopLevel;
                        }

                        const taskOptions = await this.createTaskPrompt(viewTasksDiv as HTMLDivElement);

                        if (taskOptions) {
                            await this.plugin.dataEditor.addTask(viewIndex, taskOptions);
                            this.changeView(viewIndex);
                        }
                    });

                    // Add Subject Button
                    const subjectButton = this.createMenuButton(
                        dropdownList, 
                        undefined, 
                        { icon: "copy-plus", text: "Add subject"},
                        {message: "Creates a subject in the current view", position: "right"});

                    subjectButton?.addEventListener("click", async (click) => {
                        dropdownList?.remove();
                        dropdownList = undefined;
                        const subjectName = await this.createSubjectPrompt();

                        if (subjectName !== undefined) {
                            await this.plugin.dataEditor.addSubject(viewIndex, subjectName);
                            this.changeView(viewIndex);    
                        }
                    });  
                } else {
                    dropdownList?.remove();
                    dropdownList = undefined;
                }
            });    
        }
        
        // Set the view title
        const viewName = views[viewIndex].name;
		headerLeft.createEl("h1", { text: viewName });

        // ------------------- RIGHT HEADER ------------------- //

        // Create the edit button
        const editIcon = this.editMode ? "book-open" : "pencil";
        const attributeMessage = this.editMode ? "Switch to view mode" : "Switch to edit mode\nFor editing, reordering or deleting tasks/subjects"
        const editButton = this.createIconButton(this.divHeader, {attr: {"id": "edit-button"}}, editIcon, {message: attributeMessage});

        editButton.addEventListener("click", (click) => {
            this.editMode = !this.editMode;
            this.changeView(viewIndex);
        });
    }

    async createReadMode(viewIndex: number) {
        this.divBody.empty();

        const view = this.plugin.data.views[viewIndex];
        const subjects = this.plugin.data.views[viewIndex].subjects;
        
        const viewTasks = this.divBody.createEl("div", {cls: "homework-manager-view-tasks", attr: {"id": "subject"},});

        // Create top level tasks
        view.tasks.forEach(async (task: any, taskIndex: number) => {
            const check = this.createTask(viewTasks, task, taskIndex, viewIndex);

			if (check !== undefined) {
            	check.addEventListener("click", async (click) => {
                	await this.plugin.dataEditor.removeTask(viewIndex, taskIndex);
                	this.changeView(viewIndex);
            	});
			}
        });

        // Create subjects and tasks
		if (this.plugin.data.settings.autoSortForTaskQuantity) {
			subjects.sort((a, b) => (a.tasks.length > b.tasks.length) ? -1 : 1);
		}

        subjects.forEach((subject: any, subjectIndex: number) => {
            // Create subject title
            const subjectDiv =  this.divBody.createEl("div", {attr: {"id": "subject"}});
            
            const titleDiv = subjectDiv.createEl("div", {attr: {"id": "title"}});
            titleDiv.createEl("h2", {text: subject.name});

            // Add subject new task button
            const newTaskButton = this.createIconButton(
                titleDiv,
                undefined,
                "plus",
                {message: "Add new task to subject"}
            );

            newTaskButton.addEventListener("click", async (click) => {
                const taskOptions = await this.createTaskPrompt(subjectDiv);

                if (taskOptions) {
                    await this.plugin.dataEditor.addTask(viewIndex, taskOptions, subjectIndex);
                    this.changeView(viewIndex);
                }
            });

            // Create tasks under subject
            const tasks = subject.tasks;

            tasks.forEach(async (task: any, taskIndex: number) => {
                const check = this.createTask(subjectDiv, task, taskIndex, viewIndex, subjectIndex);
                
                	check.addEventListener("click", async (click) => {
                    	await this.plugin.dataEditor.removeTask(viewIndex, taskIndex, subjectIndex);
                    	this.changeView(viewIndex);
                	});
				
            });
        });
    }

    createEditMode(viewIndex: number) {
        this.divBody.empty();

        const view = this.plugin.data.views[viewIndex];
        const subjects = this.plugin.data.views[viewIndex].subjects;
        
        const viewTasks = this.divBody.createEl("div", {cls: "homework-manager-view-tasks", attr: {"id": "subject"},});

        // Create top level tasks
        view.tasks.forEach(async (task: any, taskIndex: number) => {
            this.createEditTask(viewTasks, task, taskIndex, viewIndex);
        });

        // Create subjects and tasks
        subjects.forEach((subject: any, subjectIndex: number) => {
            // Create subject title
            const subjectDiv =  this.divBody.createEl("div", {attr: {"id": "subject"}});
            
            const titleDiv = subjectDiv.createEl("div", {attr: {"id": "title"}});
            let title = titleDiv.createEl("input", {cls: "hidden-textbox subject-box", type: "text", value: subject.name});

            title.addEventListener("change", async (change) => {
                subject.name = title.value;
                await this.plugin.writeData();
            });
            // Create tasks under subject
            const tasks = subject.tasks;

            tasks.forEach(async (task: any, taskIndex: number) => {
                this.createEditTask(subjectDiv, task, taskIndex, viewIndex, subjectIndex);
            });
        });
    }

	createEditTask(div: HTMLDivElement, task: any, taskIndex: number, viewIndex: number, subjectIndex?: number) {
		const taskDiv = div.createEl("div", {attr: {"id": "task", "display": "flex"}});
        const leftDiv = taskDiv.createEl("div");
        const rightDiv = taskDiv.createEl("div");
		leftDiv.style.display = "flex";
		leftDiv.style.flexDirection = "row";

		const righterDiv = leftDiv.createEl("div");

		righterDiv.style.display = "flex";
		righterDiv.style.flexDirection = "row";
		let up = righterDiv.createEl("p", {text: " ↑ "})
		righterDiv.createEl("p", {text: "   "})
		let down = righterDiv.createEl("p", {text: " ↓ "})
		// Create check by default

		up.addEventListener("click", async (click) => {
			await this.plugin.dataEditor.moveTask(viewIndex, taskIndex, true, subjectIndex);
			this.changeView(viewIndex);
		});

		down.addEventListener("click", async (click) => {
			await this.plugin.dataEditor.moveTask(viewIndex, taskIndex, false, subjectIndex);
			this.changeView(viewIndex);
		});

		const nameBox = leftDiv.createEl("input", {type: "text", value: task.name, cls: "hidden-textbox"});

		nameBox.addEventListener("change", async (change) => {
			task.name = nameBox.value;
			await this.plugin.writeData();
		});

		const fileButton = leftDiv.createEl("button", {text: "File"});

		const dateButton = rightDiv.createEl("input", {type: "date", value: task.date});

        let page = "";

        fileButton.addEventListener('click', () => {
            new SuggestFileModal(this.app, (result) => {
                page = result.path;
                fileButton.setText(result.name);
                task.page = page;
                this.plugin.writeData();
            }).open();
        });

        dateButton.addEventListener("change", async (change) => {
            task.date = dateButton.value;
            await this.plugin.writeData();
        });
	}

    createTask(div: HTMLDivElement, task: any, taskIndex: number, viewIndex: number, subjectIndex?: number): HTMLDivElement {
        const taskDiv = div.createEl("div", {attr: {"id": "task", "display": "flex"}});
        const leftDiv = taskDiv.createEl("div");
        const rightDiv = taskDiv.createEl("div");
		leftDiv.style.display = "flex";
		leftDiv.style.flexDirection = "row";
        let interactionDiv;

        interactionDiv = leftDiv.createEl("div", {attr: {"id": "check"}});
    
        // Task name
        const taskName = leftDiv.createEl("p", {text: task.name});

        if (task.page !== "") {
            taskName.addClass("homework-manager-link");

            if (this.plugin.data.settings.showTooltips) {
                taskName.setAttribute("aria-label", "Go to linked file");
                taskName.setAttribute("data-tooltip-position", "right");
            }

            taskName.addEventListener("click", (click) => {
                const file = this.app.vault.getAbstractFileByPath(task.page);

                if (file instanceof TFile)
                {
                    this.app.workspace.getLeaf().openFile(file);
                    this.close();
                    return;
                }

                new Notice("Linked file cannot be found.");
            });
        }

        // Due date
        if (task.date.length > 0) {
            const date = new Date(task.date);

            let formattedDate = date.toLocaleDateString(undefined, {
                weekday: 'short',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

            const today = new Date();

            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);

            const tomorrow = new Date();
            tomorrow.setDate(today.getDate() + 1);

            if (date.toDateString() == today.toDateString()) {
                formattedDate = "Today";
            } else if (date.toDateString() == tomorrow.toDateString()) {
                formattedDate = "Tomorrow";
            } else if (date.toDateString() == yesterday.toDateString()) {
                formattedDate = "Yesterday";
            } 

            const taskDate = rightDiv.createEl("p", {text: formattedDate, attr: {"id": "date"}});    

            if (today > date && today.toDateString() !== date.toDateString()) {
                taskDate.style.color = "var(--text-error)";
            }
        }

        return interactionDiv;
    }

    createSubjectPrompt(): Promise<string | undefined> {
        this.divTopLevel.empty();
        this.divTopLevel.removeClass("homework-manager-hidden");

        const subjectPrompt = this.divTopLevel.createEl("div", {attr: {"id": "subject-prompt"}});

        const inputText = subjectPrompt.createEl("input", {type: "text", placeholder: "Enter subject name"});
        inputText.focus();

        const saveButton = this.createIconButton(subjectPrompt, undefined, "check", {message: "Confirm", position: "bottom"});
        saveButton.addClass("homework-manager-hidden");

        const cancelButton = this.createIconButton(subjectPrompt, undefined, "x", {message: "Cancel", position: "bottom"});

        inputText.addEventListener('keyup', (event) => {
            if (inputText.value.trim().length > 0) {
                saveButton.removeClass("homework-manager-hidden");
            } else {
                saveButton.addClass("homework-manager-hidden");
            }
        });

        const hideDiv = () => {
            this.divTopLevel.empty();
            this.divTopLevel.addClass("homework-manager-hidden");
        }

        return new Promise<string | undefined>((resolve) => {
            inputText.addEventListener('keyup', (event) => {
                if (event.key === 'Enter') {
                    if (inputText.value.trim().length > 0) {
                        hideDiv();
                        resolve(inputText.value.trim());
                    }
                }
            });
    
            saveButton.addEventListener("click", () => {
                hideDiv();

                if (inputText.value.trim().length > 0) {
                    resolve(inputText.value.trim());
                }
                    
                resolve(undefined);
            });
    
            cancelButton.addEventListener("click", () => {
                hideDiv();
                resolve(undefined);
            });
        });
    }

    createTaskPrompt(subjectDiv: HTMLDivElement): Promise<{name: string, date: string, page: string} | undefined> {
        let topLevel = false;
        
        if (subjectDiv === this.divTopLevel) {
            topLevel = true
        }

        if (topLevel) {
            this.divTopLevel.empty();
            this.divTopLevel.removeClass("homework-manager-hidden");
        }

        const taskPrompt = subjectDiv.createEl("div", {attr: {"id": "task-prompt"}});
        const top = taskPrompt.createEl("div", {attr: {"id": "top"}});
        const bottom = taskPrompt.createEl("div", {attr: {"id": "bottom"}});

        // Top
        const inputText = top.createEl("input", {type: "text", placeholder: "Enter task name"});
        inputText.focus();

        const saveButton = this.createIconButton(top, undefined, "check", {message: "Confirm", position: "bottom"});
        saveButton.addClass("homework-manager-hidden");

        const cancelButton = this.createIconButton(top, undefined, "x", {message: "Cancel", position: "bottom"});

        inputText.addEventListener('keyup', (event) => {
            if (inputText.value.trim().length > 0) {
                saveButton.removeClass("homework-manager-hidden");
            } else {
                saveButton.addClass("homework-manager-hidden");
            }
        });

        // Bottom
        const fileButton = bottom.createEl("button", {text: "File"});
        const dateButton = bottom.createEl("input", {type: "date"});
        let page = "";

        fileButton.addEventListener('click', () => {
            new SuggestFileModal(this.app, (result) => {
                page = result.path;
                fileButton.setText(result.name);
            }).open();
        });

        const getTaskOptions = () => {
            return {
                name: inputText.value.trim(),
                date: dateButton.value,
                page: page
            }
        }

        const hideDiv = () => {
            if (topLevel) {
                this.divTopLevel.empty();
                this.divTopLevel.addClass("homework-manager-hidden");    
            }
        }

        return new Promise<{name: string, date: string, page: string} | undefined>((resolve) => {
            inputText.addEventListener('keyup', (event) => {
                const result = getTaskOptions();

                if (event.key === 'Enter') {
                    if (result.name.length > 0) {
                        hideDiv();
                        resolve(result);
                    }
                }
            });
    
            saveButton.addEventListener("click", () => {
                const result = getTaskOptions();
                hideDiv();

                if (result.name.length > 0) {
                    resolve(result);
                } 
                taskPrompt.remove();
                resolve(undefined);     
            });
    
            cancelButton.addEventListener("click", () => {
                hideDiv();
                taskPrompt.remove();
                resolve(undefined);
            });
        });
    }

    createIconButton(
        div: HTMLDivElement, 
        elementInfo: string | DomElementInfo | undefined, 
        icon: string, 
        attribute?: {
            message: string, 
            position?: string
        }): HTMLSpanElement
    {    
        const button = div.createEl("span", elementInfo);
        button.addClass("clickable-icon");
        setIcon(button, icon);

        if (attribute?.message && this.plugin.data.settings.showTooltips) {
            button.setAttribute("aria-label", attribute.message);

            if (attribute.position) {
                button.setAttribute("data-tooltip-position", attribute.position);    
            } else {
                button.setAttribute("data-tooltip-position", "top");    
            }
        }

        return button;
    }

    createMenuButton(
        div: HTMLDivElement, 
        elementInfo: string | DomElementInfo | undefined,
        item: {
            icon?: string,
            text?: string,
        },
        attribute?: {
            message: string, 
            position?: string
        }): HTMLDivElement
    {    
        const button = div.createEl("div", elementInfo);
        button.addClass("menu-item");

        if (item.icon) {
            const buttonIcon = button.createEl("div", {cls: "menu-item-icon"});
            setIcon(buttonIcon, item.icon);    
        }
        
        if (item.text) {
            button.createEl("div", {cls: "menu-item-title", "text": item.text});
        }
        
        if (attribute?.message && this.plugin.data.settings.showTooltips) {
            button.setAttribute("aria-label", attribute.message);

            if (attribute.position) {
                button.setAttribute("data-tooltip-position", attribute.position);    
            } else {
                button.setAttribute("data-tooltip-position", "top");    
            }
        }

        return button;
    }
}
