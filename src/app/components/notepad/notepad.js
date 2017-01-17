/* global chrome */

import { Component } from "@angular/core";

@Component({
    selector: "notepad",
    template: `
        <textarea class="input main-block-notepad"
            [value]="notepad"
            (input)="onInput($event)"
            (keydown)="preventLossOfFocus($event)">
        </textarea>
    `
})
export class Notepad {
    constructor() {
        this.notepad = "";
    }

    ngOnInit() {
        chrome.storage.sync.get("notepad", storage => {
            this.notepad = storage.notepad || localStorage.getItem("notepad") || "";
        });
    }

    insertSpace(elem) {
        const selectionStart = elem.selectionStart;
        const space = "\t";

        elem.value = elem.value.substring(0, selectionStart) + space + elem.value.substring(elem.selectionEnd);

        // Move caret to the end of inserted character.
        elem.selectionStart = selectionStart + 1;
        elem.selectionEnd = elem.selectionStart;
    }

    saveContent(content) {
        chrome.storage.sync.set({ notepad: content });
    }

    onInput(event) {
        this.saveContent(event.target.value);
    }

    preventLossOfFocus(event) {
        if (event.which === 9) {
            event.preventDefault();
            this.insertSpace(event.target);
            this.saveContent(event.target.value);
        }
    }
}
