var bcrypt = require('bcrypt');
var saltRounds = 10;
var express = require('express');
var router = express.Router();
var config = require('config-lite');
var nodemailer = require('nodemailer');

var UserModel = require('../models/users');
var checkNotLogin = require('../middlewares/check').checkNotLogin;
var email_adress = config.transporter.auth.user;

// GET /signin 登录页
router.get('/', checkNotLogin, function(req, res, next) {
    var ip = req.ip.match(/\d+\.\d+\.\d+\.\d+/);
    res.render('signin', {
        ip: ip
    });
});

// POST /signin 用户登录
router.post('/', checkNotLogin, function(req, res, next) {
    var name = req.fields.name.toString();
    var password = req.fields.password;

    UserModel.getUserByName(name)
        .then(function(user) {
            if (!user) {
                req.flash('error', '用户不存在');
                return res.redirect('back');
            }
            // 检查密码是否匹配
            return Promise.all([
                bcrypt.compare(password, user.password),
                user
            ]);
        })
        .then(function(results) {
            result = results[0];
            user = results[1];
            if (result == false) {
                req.flash('error', '用户名或密码错误');
                return res.redirect('back');
            }
            req.flash('success', '登录成功');
            // 用户信息写入 session
            delete user.password;
            req.session.user = user;
            // 跳转到主页
            res.redirect('/posts');
        })
        .catch(next);
});

// GET /signin/forget 找回密码页
router.get('/forget', checkNotLogin, function(req, res, next) {
    var f = req.query.f;
    if (!f) {
        res.render('forget');
    } else {
        UserModel.getForgotByrandom(f)
            .then(function(forget) {
                res.render('forget');
            })
            .catch(next);
    }
});

// POST /signin/forget 用户找回密码
router.post('/forget', checkNotLogin, function(req, res, next) {
    var data = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];
    var random = "";
    for (var i = 0; i < 20; i++) {
        var r = Math.floor(Math.random() * 62); //取得0-62间的随机数，目的是以此当下标取数组data里的值！  
        random += data[r]; //输出20次随机数的同时，让rrr加20次，就是20位的随机字符串了。  
    }
    var name = req.fields.name.toString();
    UserModel.getUserByName(name)
        .then(function(user) {
            if (!user) {
                req.flash('error', '用户不存在');
                return res.redirect('back');
            }
            var forgot = {
                author: user._id,
                createdAt: new Date(),
                random: random
            };
            return Promise.all([
                UserModel.createForgot(forgot),
                user
            ]);
        })
        .then(function(results) {
            var forgot = results[0];
            var user = results[1];
            var email = user.email;
            var transporter = nodemailer.createTransport(config.transporter);

            var mailOptions = {
                from: email_adress, // 发件人
                to: email, // 收件人
                subject: '欢迎使用找不回密码功能', // 标题
                text: "http://ysucsdn.cn/signin/forget?f=" + forgot // 内容
                    //html: '<b>random</b>' // html
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    return console.log(error);
                }
                console.log('Message %s sent: %s', info.messageId, info.response);
            });
            req.flash('success', '邮件已发送');
            res.redirect('back');
        })
        .catch(next);
});

module.exports = router;