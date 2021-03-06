const passport = require('passport');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify')
const mail = require('../handlers/mail');



exports.login = passport.authenticate('local',{
    failureRedirect:'/login',
    failureFlash:'Failed login',
    successRedirect:'/',
    successFlash:'You are logged in'
})

exports.logout = (req, res)=>{
    req.logout();
    req.flash('success', 'You are logged out!');
    res.redirect('/');   
}

exports.isLoggedIn= (req,res,next)=>{
    //firts check is the user is authenticated
    if(req.isAuthenticated()){
        next();
        return;
    }
    req.flash('error','Oops you must be logged in to that');
    res.redirect('/login');
}

exports.forgot = async (req,res)=>{
    //1. user email exists?
    const user = await User.findOne({email:req.body.email});
    if(!user){
        req.flash('error','No account with that email exists');
        return res.redirect('/login');
    }
    //2. Set reset tokens and expiry date on their  account
    user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordExpires = Date.now() + 3600000; //1 hora
    await user.save();
    //3. send them email with the token
    const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`
    await mail.send({
            user,
            subject: 'Password Reset',
            resetURL,
            filename:'password-reset'
        })
    req.flash('success',`Ỳou have been emailed a password reset link.`)

    //4.redirect to login page
    res.redirect('/login');

}

exports.reset = async(req,res)=>{
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: {$gt: Date.now()}
    })
    if(!user){
        req.flash('error','Password reset invalid or has invalid');
        return res.redirect('/login');
    }
    res.render('reset',{title: 'Reset your password'})
}

exports.confirmedPassword = (req,res,next)=>{
    if(req.body.password === req.body['password-confirm']){
        next();
        return;
    }
    req.flash('error','Password do not match!')
    res.redirect('back');
}

exports.update = async(req,res)=>{
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: {$gt: Date.now()}
    })
    if(!user){
        req.flash('error','Password reset invalid or has invalid');
        return res.redirect('/login');
    }
    const setPassword = promisify(user.setPassword, user)
    await setPassword(req.body.password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires=undefined;
    const updateUser = await user.save();
    await req.login(updateUser)
    req.flash('success', '💃 Nice! Your password has been reset! You are now logged in!');
    res.redirect('/');
}