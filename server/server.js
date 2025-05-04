const express = require('express');
const path = require('path');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs'); // Add this dependency

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection URI
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'digitSpan';
const COLLECTION_NAME = 'results';
const USERS_COLLECTION = 'users'; // New collection for users

if (!MONGODB_URI) {
    console.error('MongoDB connection string is not defined. Please set the MONGODB_URI environment variable.');
    process.exit(1);
}

// MongoDB client
const client = new MongoClient(MONGODB_URI);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For parsing form data
app.use(express.static(path.join(__dirname, '..'))); // Serve files from parent directory

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        // Test the connection with a simple query
        const database = client.db(DB_NAME);
        await database.command({ ping: 1 });
        console.log("MongoDB connection verified with ping");
        
        return true;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        
        // Log more detailed error information
        if (error.name === 'MongoServerSelectionError') {
            console.error('Could not select MongoDB server. Check your connection string and network settings.');
        }
        
        return false;
    }
}

// Initialize DB connection
connectToMongoDB();

// Endpoint to save results
app.post('/api/save-result', async (req, res) => {
    const { taskId, score, timestamp = new Date().toISOString() } = req.body;
    
    if (!taskId || score === undefined) {
        return res.status(400).json({ error: 'Missing required fields: taskId and score' });
    }
    
    try {
        const database = client.db(DB_NAME);
        const collection = database.collection(COLLECTION_NAME);
        
        // Insert the result
        await collection.insertOne({ taskId, score, timestamp });
        
        console.log(`Saved result: ${taskId}, ${score}, ${timestamp}`);
        res.status(200).json({ success: true, message: 'Result saved successfully' });
    } catch (error) {
        console.error('Error saving result:', error);
        res.status(500).json({ error: 'Failed to save result' });
    }
});

// Replace the current app.get('/admin') handler with this updated version:
app.get('/admin', async (req, res) => {
    const { username, password, error } = req.query;
    
    // If no credentials are provided, show the login form
    if (!username || !password) {
        const errorMessage = error ? decodeURIComponent(error) : '';
        return res.status(200).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Admin Login - Digit Span Task</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }
                    
                    .container {
                        background-color: #f9f9f9;
                        padding: 30px;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                        width: 100%;
                    }
                    
                    h1 {
                        text-align: center;
                        color: #333;
                    }
                    
                    form {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        max-width: 500px;
                        margin: 0 auto;
                        width: 100%;
                    }
                    
                    .form-group {
                        margin-bottom: 20px;
                        width: 100%;
                        text-align: center;
                    }
                    
                    label {
                        display: block;
                        margin-bottom: 10px;
                        font-weight: bold;
                        width: 100%;
                        font-size: 18px;
                    }
                    
                    input[type="text"],
                    input[type="password"] {
                        width: 100%;
                        padding: 15px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        box-sizing: border-box;
                        font-size: 18px;
                        text-align: center;
                    }
                    
                    button {
                        background-color: #4CAF50;
                        color: white;
                        padding: 12px 20px;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 18px;
                        display: block;
                        margin-top: 30px;
                        width: 100%;
                    }
                    
                    button:hover {
                        background-color: #45a049;
                    }
                    
                    .error-message {
                        color: #d32f2f;
                        text-align: center;
                        padding: 10px;
                        margin-bottom: 20px;
                        background-color: #ffebee;
                        border-radius: 4px;
                        display: ${errorMessage ? 'block' : 'none'};
                    }
                    
                    .signup-link {
                        text-align: center;
                        margin-top: 20px;
                    }
                    
                    .signup-link a {
                        color: #2196F3;
                        text-decoration: none;
                        font-weight: bold;
                    }
                    
                    .signup-link a:hover {
                        text-decoration: underline;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Admin Login</h1>
                    
                    <div class="error-message">${errorMessage}</div>
                    
                    <form id="loginForm" action="/admin-login" method="POST">
                        <div class="form-group">
                            <label for="username">Username:</label>
                            <input type="text" id="username" name="username" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="password">Password:</label>
                            <input type="password" id="password" name="password" required>
                        </div>
                        
                        <button type="submit">Login</button>
                    </form>
                </div>
            </body>
            </html>
        `);
    }
    
    // Rest of your existing admin code for when credentials are provided
    try {
        const database = client.db(DB_NAME);
        const users = database.collection(USERS_COLLECTION);
        
        // Find user by username
        const user = await users.findOne({ username });
        
        // If user not found or password doesn't match
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.redirect('/admin?error=' + encodeURIComponent('Invalid username or password'));
        }
        
        // Authentication successful - continue with the original admin functionality
        const collection = database.collection(COLLECTION_NAME);
        
        // Get all results sorted by timestamp (newest first)
        const results = await collection.find({}).sort({ timestamp: -1 }).toArray();
        
        // Rest of your existing code...
        // Generate CSV content
        let csvContent = 'taskId,score,timestamp\n';
        results.forEach(result => {
            csvContent += `${result.taskId},${result.score},${result.timestamp}\n`;
        });
        
        // Create table rows for HTML display
        const tableRows = results.map(result => `
            <tr>
                <td>${result.taskId}</td>
                <td>${result.score}</td>
                <td>${result.timestamp}</td>
            </tr>
        `).join('');
        
        // Send HTML page with results
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Digit Span Task Results</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .download-btn { 
                        background-color: #4CAF50; 
                        color: white; 
                        padding: 10px 15px; 
                        border: none; 
                        border-radius: 4px; 
                        cursor: pointer; 
                        margin-bottom: 20px; 
                    }
                    h1 { margin-bottom: 20px; }
                    .no-results {
                        text-align: center;
                        padding: 20px;
                        color: #777;
                        font-style: italic;
                    }
                    .user-info {
                        background-color: #e8f5e9;
                        padding: 10px;
                        margin-bottom: 20px;
                        border-radius: 4px;
                    }
                </style>
            </head>
            <body>
                <div class="user-info">
                    Logged in as: <strong>${username}</strong>
                </div>
                <h1>Digit Span Task Results</h1>
                
                ${results.length > 0 ? `
                <button class="download-btn" onclick="downloadCSV()">Download CSV</button>
                <table>
                    <thead>
                        <tr>
                            <th>Task ID</th>
                            <th>Score</th>
                            <th>Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                ` : '<div class="no-results">No results found</div>'}

                <script>
                    function downloadCSV() {
                        const csvContent = \`${csvContent}\`;
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'digit_span_results.csv';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    }
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error retrieving results:', error);
        res.status(500).send('Error retrieving results from database');
    }
});

// Add this new route for handling login form submission
app.post('/admin-login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Basic validation
        if (!username || !password) {
            return res.redirect('/admin?error=' + encodeURIComponent('Username and password are required'));
        }
        
        const database = client.db(DB_NAME);
        const users = database.collection(USERS_COLLECTION);
        
        // Find user by username
        const user = await users.findOne({ username });
        
        // If user not found or password doesn't match
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.redirect('/admin?error=' + encodeURIComponent('Invalid username or password'));
        }
        
        // Successful login - redirect to admin with credentials
        res.redirect(`/admin?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
    } catch (error) {
        console.error('Error during login:', error);
        res.redirect('/admin?error=' + encodeURIComponent('An unexpected error occurred'));
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// Handle process termination
process.on('SIGINT', async () => {
    try {
        await client.close();
        console.log('MongoDB connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error closing MongoDB connection:', error);
        process.exit(1);
    }
});