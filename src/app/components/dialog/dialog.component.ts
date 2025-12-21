import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogService, DialogOptions } from '../../services/dialog.service';

@Component({
    selector: 'app-dialog',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './dialog.component.html',
    styleUrls: ['./dialog.component.css']
})
export class DialogComponent implements OnInit {
    isOpen = false;
    options: (DialogOptions & { resolve: (value: any) => void }) | null = null;
    promptValue = '';

    constructor(private dialogService: DialogService) { }

    ngOnInit() {
        this.dialogService.dialog$.subscribe(options => {
            this.options = options;
            this.promptValue = options.defaultValue || '';
            this.isOpen = true;
        });
    }

    close(result: any) {
        this.isOpen = false;
        if (this.options) {
            if (this.options.type === 'prompt' && result === true) {
                this.options.resolve(this.promptValue);
            } else {
                this.options.resolve(result);
            }

            setTimeout(() => {
                this.options = null;
                this.promptValue = '';
            }, 300); // Wait for animation
        }
    }
}
