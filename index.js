const express = require('express')
const app = express();
const dotenv = require('dotenv')
const mysql = require('mysql')
const { nanoid } = require('nanoid')
const bcrypt = require('bcrypt');
const passport = require('passport');
const LocalStrategy = require("passport-local")
dotenv.config();

//Note for Express 4.16.0 and higher: 
//body parser has been re-added to provide request body parsing support out-of-the-box.


app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(__dirname + "/public"));
app.set('view engine', 'ejs');

//=============================
//  DATABASE CONNECTION
//=============================
const db = mysql.createConnection({
    host: process.env.HOST,
    port: 3306,
    user: process.env.USER,
    password: process.env.PASS,
    database: 'feedbackSys'
});

db.connect(function(err) {
    if (err) {
      console.error('Database connection failed: ' + err.stack);
      return;
    } 
    console.log('Connected to database');
});

//========================================
//  PASSPORT CONFIGURATION
//========================================
app.use(require("express-session")({
    secret: "ready_to_die",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy((username, password, done)=>{
    db.query(`select * from user where username='${username}' `,async(err, user)=>{
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        if(err){
            return done(err);           
        }
        if(!user){
            
            return done(null,false,{message: 'User Not Found!'});  

        }
        bcrypt.compare(password, user[0].password, function(err, isMatch) {
            if (err) {
              throw err
            } else if (!isMatch) {
              console.log("Password doesn't match!")
              return done(null,false,{message: 'Incorrect Password'});
            } else {
              console.log("Password matches!")
            }
        })
        

        return done(null,user[0]);     
        });
    }
));

passport.serializeUser(function(user, done) {
    done(null, user);
});
passport.deserializeUser(function(user, done) {
    done(null, user);
});

app.use((req, res, next)=>{
    res.locals.current_user = req.user;
    next();
})

//==================
//  FUNCTIONS
//=================

const run=(q)=>{
    db.query(q, (err, result)=>{
        if(err) throw err;
        console.log(result);
    })
}



const get_date = () =>{
    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    return date;
}

const create_user = async()=>{
    const date = get_date();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('123456', salt);

    const new_user = {
        id: nanoid(),
        username: 'Nikhil',
        password: hashedPassword,
        email: 'maurya.kumar@iiitg.ac.in',
        usertype: 'admin',
        created_at: date
    }

    let sql = 'INSERT INTO user SET ?';
    let query = db.query(sql, new_user, (err, result)=>{
        if(err) throw err;
        return result;
    });
    console.log(query);
}

//----------------
//  Check Login
//----------------
const middleware = {}
middleware.isLoggedIn = (req, res, next)=>{
    if(req.isAuthenticated()){
        return next();
    }
    // req.flash("error", "Please Login First!");
    res.redirect("/login");
}


//=================
//  ROUTES
//=================
app.get("/", (req, res)=>{
    res.redirect('/login')
})


app.get("/login", (req, res)=>{
    res.render('index/login.ejs')
})

app.post("/login", passport.authenticate("local", {
    
    failureRedirect : "/login"
}), (req, res)=>{
    if(!(req.user.username && req.user.password)){
        res.redirect('/login')
    }
    
    const username = req.user.username
    res.redirect( `/feedback/${username}`)
    
})

app.get("/logout", function(req, res){
    req.logout();
    res.redirect("/");
});

app.get("/register", (req, res)=>{
    res.render('index/register.ejs')
})

app.post("/register", async(req, res) =>{

    const date = get_date();

    // hashing password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

  
    const new_user = {
        id: nanoid(),
        username: req.body.username,
        password: hashedPassword,
        email: req.body.email,
        usertype: 'customer',
        created_at: date
    }
    
    let sql = 'INSERT INTO user SET ?';
    let query = db.query(sql, new_user, (err, result)=>{
        if(err) throw err;
        return result;
    });

    res.redirect('/login');
});



app.get("/feedback/:username", middleware.isLoggedIn, (req, res) =>{

    let sql = `SELECT * FROM user where username='${req.params.username}' `;

    let query = db.query(sql, (err, result)=>{
        if(err) throw err;
        if(result[0].usertype == 'admin'){
            sql = `SELECT * FROM feedback`;
            
   
            let query = db.query(sql, (err, result)=>{
                if(err) throw err;
                res.render('feedback/index.ejs', {feedback:result})
            });
        }
        else{

            sql = `SELECT * FROM feedback where username='${req.params.username}' `;
            
   
            let query = db.query(sql, (err, result)=>{
                if(err) throw err;
                res.render('feedback/index.ejs', {feedback:result})
            });

        }
    });

    
})

app.post("/feedback/:username/create", middleware.isLoggedIn,(req, res)=>{
    const date = get_date();


    const new_feedback = {
        id: nanoid(),
        username: req.params.username,
        service:req.body.service,
        description: req.body.description,
        created_at: date
    }

    let sql = 'INSERT INTO feedback SET ?';
    let query = db.query(sql, new_feedback, (err, result)=>{
        if(err) throw err;
        return result;
    });

    res.redirect(`/feedback/${req.params.username}`);
})

app.get("/feedback/:username/create", (req, res)=>{
    res.render('feedback/new.ejs');
})


PORT = 4000
app.listen(PORT, process.env.IP, (req, res, err) =>{
    console.log(`Server started at http://localhost:${PORT}`)
    console.log(`Server started at http://${process.env.IP}:${PORT}`)
})
