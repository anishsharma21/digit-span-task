document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('nextButton').addEventListener('click', function() {
        const subjectNumber = document.getElementById('subjectNumber').value;
        const sessionNumber = document.getElementById('sessionNumber').value;
        
        if (!subjectNumber || !sessionNumber) {
            alert('Please enter both subject number and session number.');
            return;
        }
        
        // Store the values (if needed for future use)
        localStorage.setItem('subjectNumber', subjectNumber);
        localStorage.setItem('sessionNumber', sessionNumber);
        
        // For now, just display a confirmation
        alert('Subject: ' + subjectNumber + ', Session: ' + sessionNumber + ' - Form submitted!');
        
        // In the future, you would add navigation here
        // window.location.href = "next-page.html";
    });
});