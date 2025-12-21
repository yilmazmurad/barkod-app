import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface DialogOptions {
    title: string;
    message: string;
    type: 'alert' | 'confirm' | 'prompt';
    confirmText?: string;
    cancelText?: string;
    icon?: 'success' | 'error' | 'warning' | 'info';
    defaultValue?: string;
}

@Injectable({
    providedIn: 'root'
})
export class DialogService {
    private dialogSubject = new Subject<DialogOptions & { resolve: (value: any) => void }>();
    dialog$ = this.dialogSubject.asObservable();

    alert(title: string, message: string, icon: 'success' | 'error' | 'warning' | 'info' = 'info'): Promise<void> {
        return new Promise((resolve) => {
            this.dialogSubject.next({
                title,
                message,
                type: 'alert',
                icon,
                resolve: () => resolve()
            });
        });
    }

    confirm(title: string, message: string, confirmText = 'Evet', cancelText = 'Hayır'): Promise<boolean> {
        return new Promise((resolve) => {
            this.dialogSubject.next({
                title,
                message,
                type: 'confirm',
                confirmText,
                cancelText,
                icon: 'warning',
                resolve
            });
        });
    }

    prompt(title: string, message: string, defaultValue: string = '', confirmText = 'Kaydet', cancelText = 'İptal'): Promise<string | null> {
        return new Promise((resolve) => {
            this.dialogSubject.next({
                title,
                message,
                type: 'prompt',
                defaultValue,
                confirmText,
                cancelText,
                icon: 'info',
                resolve
            });
        });
    }
}
