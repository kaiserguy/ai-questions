const express = require('express');
const path = require('path');

module.exports = (config) => {
    const app = express();

    // Set up EJS as the view engine
    app.set('view engine', 'ejs');
    app.set("views", path.join(__dirname, 'views'));
    // Serve static files from the 'public' directory
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.json());

    // Add common middleware or configurations here

    return app;
};

