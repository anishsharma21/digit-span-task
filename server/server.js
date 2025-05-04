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

// Signup endpoint - GET renders the signup form
app.get('/signup', (req, res) => {
    const errorMessage = req.query.error ? decodeURIComponent(req.query.error) : '';
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Admin Signup - Digit Span Task</title>
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
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Create Admin Account</h1>
                
                <div class="error-message">${errorMessage}</div>
                
                <form id="signupForm" action="/signup" method="POST">
                    <div class="form-group">
                        <label for="username">Username:</label>
                        <input type="text" id="username" name="username" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="password">Password:</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="confirmPassword">Confirm Password:</label>
                        <input type="password" id="confirmPassword" name="confirmPassword" required>
                    </div>
                    
                    <button type="submit">Create Account</button>
                </form>
            </div>
            
            <script>
                document.addEventListener('DOMContentLoaded', function() {
                    document.getElementById('signupForm').addEventListener('submit', function(e) {
                        const password = document.getElementById('password').value;
                        const confirmPassword = document.getElementById('confirmPassword').value;
                        
                        if (password !== confirmPassword) {
                            e.preventDefault();
                            alert('Passwords do not match');
                        }
                    });
                });
            </script>
        </body>
        </html>
    `);
});

// Signup endpoint - POST processes the form submission
app.post('/signup', async (req, res) => {
    try {
        const { username, password, confirmPassword } = req.body;
        
        // Basic validation
        if (!username || !password) {
            return res.redirect('/signup?error=' + encodeURIComponent('Username and password are required'));
        }
        
        if (password !== confirmPassword) {
            return res.redirect('/signup?error=' + encodeURIComponent('Passwords do not match'));
        }
        
        // Minimum password length
        if (password.length < 8) {
            return res.redirect('/signup?error=' + encodeURIComponent('Password must be at least 8 characters long'));
        }
        
        const database = client.db(DB_NAME);
        const users = database.collection(USERS_COLLECTION);
        
        // Check if user already exists
        const existingUser = await users.findOne({ username });
        if (existingUser) {
            return res.redirect('/signup?error=' + encodeURIComponent('Username already exists'));
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Create new user
        await users.insertOne({
            username,
            password: hashedPassword,
            createdAt: new Date()
        });
        
        // Redirect to success page
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Account Created - Digit Span Task</title>
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
                        text-align: center;
                    }
                    
                    h1 {
                        color: #4CAF50;
                    }
                    
                    p {
                        font-size: 18px;
                        margin: 20px 0;
                    }
                    
                    .link {
                        display: inline-block;
                        margin-top: 20px;
                        color: #2196F3;
                        text-decoration: none;
                        font-weight: bold;
                    }
                    
                    .link:hover {
                        text-decoration: underline;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Account Created Successfully!</h1>
                    <p>Your admin account has been created. You can now access the admin dashboard.</p>
                    <p>Username: ${username}</p>
                    <a href="/admin?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}" class="link">Go to Admin Dashboard</a>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error creating user:', error);
        res.redirect('/signup?error=' + encodeURIComponent('An error occurred. Please try again.'));
    }
});

// Updated Admin endpoint to check credentials from database
app.get('/admin', async (req, res) => {
    const { username, password } = req.query;
    
    // Check if credentials are provided
    if (!username || !password) {
        return res.status(401).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Authentication Required - Digit Span Task</title>
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
                        text-align: center;
                    }
                    
                    h1 {
                        color: #d32f2f;
                    }
                    
                    p {
                        font-size: 18px;
                        margin: 20px 0;
                    }
                    
                    .link {
                        display: inline-block;
                        margin-top: 20px;
                        color: #2196F3;
                        text-decoration: none;
                        font-weight: bold;
                    }
                    
                    .link:hover {
                        text-decoration: underline;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Authentication Required</h1>
                    <p>You need to provide both username and password to access this page.</p>
                    <a href="/signup" class="link">Sign up for an account</a>
                </div>
            </body>
            </html>
        `);
    }
    
    try {
        const database = client.db(DB_NAME);
        const users = database.collection(USERS_COLLECTION);
        
        // Find user by username
        const user = await users.findOne({ username });
        
        // If user not found or password doesn't match
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Authentication Failed - Digit Span Task</title>
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
                            text-align: center;
                        }
                        
                        h1 {
                            color: #d32f2f;
                        }
                        
                        p {
                            font-size: 18px;
                            margin: 20px 0;
                        }
                        
                        .link {
                            display: inline-block;
                            margin-top: 20px;
                            color: #2196F3;
                            text-decoration: none;
                            font-weight: bold;
                        }
                        
                        .link:hover {
                            text-decoration: underline;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Authentication Failed</h1>
                        <p>Invalid username or password.</p>
                        <a href="/signup" class="link">Sign up for an account</a>
                    </div>
                </body>
                </html>
            `);
        }
        
        // Authentication successful - continue with the original admin functionality
        const collection = database.collection(COLLECTION_NAME);
        
        // Get all results sorted by timestamp (newest first)
        const results = await collection.find({}).sort({ timestamp: -1 }).toArray();
        
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