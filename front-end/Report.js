import { report } from "./api.js";

class Report {
    constructor() {
        document.addEventListener('DOMContentLoaded', () => {
            const report = document.getElementById('report');
            report.addEventListener('submit', this.handleReportSubmit.bind(this));
        });
    }

    async handleReportSubmit(event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const type = formData.get('type');
        const description = formData.get('description');

        try {
            await report(type, description);
            console.log('Report successful');
            window.location.replace("/");
        } catch (error) {
            console.error('Report failed:', error.message);
            const errorMessage = document.getElementById('error-message');
            if (errorMessage) {
                errorMessage.textContent = `Report failed: ${error.message}`;
                errorMessage.style.display = 'block';
            }
        }
    }
}

const a = new Report();
