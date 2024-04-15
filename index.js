const express = require('express');
const session = require('express-session');
const mysql = require('mysql2');
const { Product, createUser, verifyUserAccount} = require('./db_connect');
const dotenv = require('dotenv');

const app = express();
const port = 3000;
dotenv.config();


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs')

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); // Parse request body

const pool = mysql.createPool({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME
});

app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.get("/", function (req, res) {
    res.render('home');
});

app.get("/productPage", async function (req, res) {
    try {
        pool.getConnection((err, connection) => {
            if (err) {
                console.error('Error connecting to database:', err);
                return;

            }
            

            const productInstance = Product.getProductInstance();
            productInstance.getProductData(connection)
                .then(products => {
                    res.render('productPage', { products });
                })
                .catch(error => {
                    console.error('Error fetching product data:', error);
                    res.status(500).send('Internal Server err');
                })
                .finally(() => {
                    connection.release();
                });
        });
    } catch (error) {
        console.error('Error fetching product data:', error);
        res.status(500).send('Internal Server err');
    }
});

app.get("/", function (req, res) {
    let name = (typeof req.query.name === 'undefined') ? "World" : req.query.name;
    res.send(`Hello ${name}!`);
    
    res.render('home')
    res.render('productPage')
    res.render('shoppingCart')
    res.render('login')
    res.render('makeAccount')
    res.render('reviewPage')
    res.render('checkout')
});

app.get("shopping", function(req, res) {
    res.render("productPage.ejs")
});

app.get("/accounts", function (req, res) {
    res.send("Welcome to another page!")
});

app.get("/productPage", function (req, res) {
    res.render('productPage')
});
app.get("/checkout", function (req, res) {
    res.render('checkout')
});

app.get("/shoppingCart", function (req, res) {
    if (!req.session.cart) {
        req.session.cart = [];
    }
    console.log(req.session.cart);
    res.render('shoppingCart', { cart: req.session.cart });
});

app.get("/search", function (req, res) {
    const searchQuery = req.query.q;

    if (!searchQuery) {
        res.render('productPage', { products: [] });
        return;
    }

    pool.getConnection((err, connection) => {
        if (err) throw err;
        
        let sql = `SELECT * FROM Products WHERE Name LIKE ? OR Description LIKE ?;`;
        let query = `%${searchQuery}%`;
        
        connection.query(sql, [query, query], (err, results) => {
            if (err) throw err;
            
            res.render('productPage', { products: results });
            connection.release();
        });
    });
});

app.use((req, res, next) => {
    if (!req.session.cart) {
        req.session.cart = [];
    }
    next();
});

app.post("/addToCart", async (req, res) => {
    const productName = req.body.productName;

    pool.getConnection(async (err, connection) => {
        if (err) throw err;
        const sql = "SELECT * FROM Products WHERE Name = ?";
        connection.query(sql, [productName], (err, results) => {
            if (err) throw err;
            if (results.length > 0) {
                const product = results[0];
                if (!req.session.cart) {
                    req.session.cart = [];
                }
                req.session.cart.push(product);
                res.redirect('/productPage');
            } else {
                res.send("Product not found");
            }
            connection.release();
        });
    });
});

app.post("/buyNow", async (req, res) => {
    const productName = req.body.productName;

    pool.getConnection(async (err, connection) => {
        if (err) throw err;
        const sql = "SELECT * FROM Products WHERE Name = ?";
        connection.query(sql, [productName], (err, results) => {
            if (err) throw err;
            if (results.length > 0) {
                const product = results[0];
                if (!req.session.cart) {
                    req.session.cart = [];
                }
                req.session.cart.push(product);
                res.redirect('/shoppingCart');
            } else {
                res.send("Product not found");
            }
            connection.release();
        });
    });
});

app.post("/removeFromCart", async (req, res) => {
    const productName = req.body.productName;

    if (!req.session.cart) {
        req.session.cart = [];
    }
    req.session.cart = req.session.cart.filter(product => product.Name !== productName); // Removes all instances of the product
    res.redirect('/shoppingCart');
});

app.post("/checkout", async (req, res) => {
    if (!req.session.cart) {
        req.session.cart = [];
    }
    req.session.cart = [];
    res.redirect('/shoppingCart');
});
app.get("/reviewPage", function (req, res) {
    res.render('reviewPage')
});
// app.post("/reviewPage", async (req, res) => {
//     // const productName = req.query.productName;
//     redirect('/reviewPage')

//     // pool.getConnection(async (err, connection) => {
//     //     if (err) throw err;
//     //     const sql = "SELECT * FROM Reviews WHERE Name = ?";
//     //     connection.query(sql, [productName], (err, results) => {
//     //         if (err) throw err;
//     //         if (results.length > 0) {
//     //             const reviews = results;
//     //             res.render('reviewPage', { reviews });
//     //         } else {
//     //             res.send("No reviews found for this product");
//     //         }
//     //         connection.release();
//     //     });
//     // });
// });

app.get("/home", function (req, res){
    res.render('home.ejs')
});

app.get("/login", function (req, res){
    res.render('login.ejs')

})
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try{
        pool.getConnection((err, connection) => {
            if (err) {
                console.error('Error connecting to database:', err);
                return;
            }
            verifyUserAccount(username, password, connection)
                .then(user => {
                    if (user) {
                        res.send('Login successful');
                    }
                })
                .catch(error => {
                    console.error('Error verifying user account:', error);
                    res.status(401).send('Invalid username or password');
                })
                .finally(() => {
                    connection.release();
                });
        });
    } catch (error) {
        console.error('Error processing login request:', error);
        res.status(500).send('Internal Server Error');
    }
})

app.post('/FOOD', function (req, res){
    const category = "food";

    if (!category) {
        res.render('productPage', { products: [] });
        return;
    }

    pool.getConnection((err, connection) => {
        if (err) throw err;
        
        let sql = `SELECT * FROM Products WHERE Category = ?;`;
        
        connection.query(sql, [category], (err, results) => {
            if (err) throw err;
            
            res.render('productPage', { products: results });
            connection.release();
        });
    });
}) 

app.post('/TOYS', function (req, res){
    const category = "toys";

    if (!category) {
        res.render('productPage', { products: [] });
        return;
    }

    pool.getConnection((err, connection) => {
        if (err) throw err;
        
        let sql = `SELECT * FROM Products WHERE Category = ?;`;
        
        connection.query(sql, [category], (err, results) => {
            if (err) throw err;
            
            res.render('productPage', { products: results });
            connection.release();
        });
    });
}) 

app.post('/ACCESSORIES', function (req, res){
    const category = "accessories";

    if (!category) {
        res.render('productPage', { products: [] });
        return;
    }

    pool.getConnection((err, connection) => {
        if (err) throw err;
        
        let sql = `SELECT * FROM Products WHERE Category = ?;`;
        
        connection.query(sql, [category], (err, results) => {
            if (err) throw err;
            
            res.render('productPage', { products: results });
            connection.release();
        });
    });
}) 

app.post('/HEALTH', function (req, res){
    const category = "health";

    if (!category) {
        res.render('productPage', { products: [] });
        return;
    }

    pool.getConnection((err, connection) => {
        if (err) throw err;
        
        let sql = `SELECT * FROM Products WHERE Category = ?;`;
        
        connection.query(sql, [category], (err, results) => {
            if (err) throw err;
            
            res.render('productPage', { products: results });
            connection.release();
        });
    });
}) 

app.post('/DOGS', function (req, res){
    const category = "dog";

    if (!category) {
        res.render('productPage', { products: [] });
        return;
    }

    pool.getConnection((err, connection) => {
        if (err) throw err;
        
        let sql = `SELECT * FROM Products WHERE AnimalType = ?;`;
        
        connection.query(sql, [category], (err, results) => {
            if (err) throw err;
            
            res.render('productPage', { products: results });
            connection.release();
        });
    });
}) 

app.post('/CATS', function (req, res){
    const category = "cat";

    if (!category) {
        res.render('productPage', { products: [] });
        return;
    }

    pool.getConnection((err, connection) => {
        if (err) throw err;
        
        let sql = `SELECT * FROM Products WHERE AnimalType = ?;`;
        
        connection.query(sql, [category], (err, results) => {
            if (err) throw err;
            
            res.render('productPage', { products: results });
            connection.release();
        });
    });
}) 

app.post('/FISH', function (req, res){
    const category = "fish";
    const all = "All Pets"

    if (!category) {
        res.render('productPage', { products: [] });
        return;
    }

    pool.getConnection((err, connection) => {
        if (err) throw err;
        
        let sql = `SELECT * FROM Products WHERE AnimalType = ?;`;
        
        connection.query(sql, [category || all], (err, results) => {
            if (err) throw err;
            
            res.render('productPage', { products: results });
            connection.release();
        });
    });
}) 
app.post('/ALL', function (req, res){
    const category = "All Pets"

    if (!category) {
        res.render('productPage', { products: [] });
        return;
    }

    pool.getConnection((err, connection) => {
        if (err) throw err;
        
        let sql = `SELECT * FROM Products WHERE AnimalType = ?;`;
        
        connection.query(sql, [category || all], (err, results) => {
            if (err) throw err;
            
            res.render('productPage', { products: results });
            connection.release();
        });
    });
}) 


app.get("/makeAccount", function (req, res){
    res.render('makeAccount.ejs')
})
app.post('/makeAccount', async (req, res) => {
    const { username, password, confirmPassword, email } = req.body;

    if (password === '' | username === '' | email === '') {
        return res.status(400).send('Please fill in all information');
    }
    if (password !== confirmPassword){
        return res.status(400).send('Password and Confirm Password do not match');
    }
    try {
        pool.getConnection((err, connection) => {
            if (err) {
                console.error('Error connecting to database:', err);
                return;
            }
            console.log(`MySQL Connected to create user account`);
            createUser(username, password, email, connection)
            .then(results => {
                if (results) {
                    res.send('User Created Successfully');
                }
            })
            .catch(error => {
                console.error('Error creating account:', error);
                res.status(401).send('Error creating account');
            })
            .finally(() => {
                connection.release();
            });
         });


    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).send('Error creating user');   
    }
})
app.listen(port, function () {
    console.log(`Example app listening on port ${port}!`);
});
