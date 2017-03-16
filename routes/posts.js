var express = require('express');
var router = express.Router();

var PostModel = require('../models/posts');
var UserModel = require('../models/users');
var CommentModel = require('../models/comments');
var checkLogin = require('../middlewares/check').checkLogin;
var checkAdmin = require('../middlewares/check').checkAdmin;

// GET /posts 文章页
//   eg: GET /posts?page=***
router.get('/', function(req, res, next) {
    var page = req.query.page || 1;
    var ip = req.ip.match(/\d+\.\d+\.\d+\.\d+/);

    if (parseInt(page) == 1) {
        Promise.all([
                PostModel.getrecentPosts(page),
                PostModel.gettopPosts()
            ])
            .then(function(results) {
                posts = results[0];
                tops = results[1];
                res.render('posts', {
                    posts: posts,
                    tops: tops,
                    ip: ip
                });
            })
            .catch(next);
    } else {
        PostModel.getrecentPosts(page)
            .then(function(posts) {
                res.render('components/recent-posts', {
                    posts: posts
                });
            })
            .catch(next);
    }
});

// GET /posts 搜索页
//   eg: GET /posts/s?search=***
router.get('/s', function(req, res, next) {
    var author = req.query.author;
    var search = req.query.search;
    var page = req.query.page || 1;
    var ip = req.ip.match(/\d+\.\d+\.\d+\.\d+/);

    if (parseInt(page) == 1) {
        PostModel.getresults(author, page, search)
            .then(function(posts) {
                res.render('search', {
                    posts: posts,
                    ip: ip
                });
            })
            .catch(next);
    } else {
        PostModel.getresults(author, page, search)
            .then(function(posts) {
                res.render('components/limit-posts', {
                    posts: posts
                });
            })
            .catch(next);
    }
});

// GET /posts 特定用户的文章页
//   eg: GET /posts/user?author=xxx
router.get('/user', function(req, res, next) {
    var author = req.query.author;
    var search = req.query.search;
    var page = req.query.page || 1;
    var ip = req.ip.match(/\d+\.\d+\.\d+\.\d+/);

    if (parseInt(page) == 1) {
        Promise.all([
                PostModel.getresults(author, page, search),
                UserModel.getUserById(author)
            ])
            .then(function(results) {
                var posts = results[0];
                var author = results[1];
                if (!author) {
                    req.flash('error', '没有这个用户');
                    return res.redirect('/posts');
                } else {
                    res.render('user_posts', {
                        posts: posts,
                        author: author,
                        ip: ip,
                        page: page
                    });
                }
            })
            .catch(next);
    } else {
        PostModel.getresults(author, page, search)
            .then(function(posts) {
                res.render('components/limit-posts', {
                    posts: posts,
                    page: page
                });
            })
            .catch(next);
    }
});


// GET /posts/create 发表文章页
router.get('/create', checkLogin, function(req, res, next) {
    var ip = req.ip.match(/\d+\.\d+\.\d+\.\d+/);
    res.render('create', {
        ip: ip
    });
});

// POST /posts 发表一篇文章
router.post('/', checkLogin, function(req, res, next) {
    var author = req.session.user._id;
    var title = req.fields.title;
    var content = req.fields.content;

    // 校验参数
    try {
        if (!title.length) {
            throw new Error('请填写标题');
        }
        if (!content.length) {
            throw new Error('请填写内容');
        }
    } catch (e) {
        req.flash('error', e.message);
        return res.redirect('back');
    }

    var post = {
        author: author,
        title: title,
        content: content,
        pv: 0,
        top: 0
    };

    PostModel.create(post)
        .then(function(result) {
            // 此 post 是插入 mongodb 后的值，包含 _id
            post = result.ops[0];
            req.flash('success', '发表成功');
            // 发表成功后跳转到该文章页
            res.redirect(`/posts/${post._id}`);
        })
        .catch(next);
});

// GET /posts/:postId 单独一篇的文章页
router.get('/:postId', function(req, res, next) {
    var postId = req.params.postId;
    var page = req.query.page || 1;
    var ip = req.ip.match(/\d+\.\d+\.\d+\.\d+/);
    var w_pv; //判断是否+1s//1 +1s//0
    var reading = new RegExp(postId);
    if (reading.test(req.session.read) == false) {
        w_pv = 1;
        req.session.read = req.session.read + postId + ',';
    } else {
        w_pv = 0;
    }
    if (parseInt(page) == 1) {
        // pv 加 1   浏览量
        PostModel.incPv(postId, w_pv)
            .then(function(incPv_result) {
                return Promise.all([
                    PostModel.getPostById(postId), // 获取文章信息
                    CommentModel.getCommentslimit(postId, page) // 获取该文章所有留言
                ]);
            })
            .then(function(results) {
                var post = results[0];
                var comments = results[1];
                if (!post) {
                    throw new Error('该文章不存在');
                }
                res.render('post', {
                    post: post,
                    comments: comments,
                    ip: ip,
                    page: page
                });
            })
            .catch(next);
    } else {
        CommentModel.getCommentslimit(postId, page) // 获取该文章留言
            .then(function(comments) {
                res.render('components/limit-comments', {
                    comments: comments,
                    page: page
                });
            })
            .catch(next);
    }
});

// GET /posts/:postId/edit 更新文章页
router.get('/:postId/edit', checkLogin, function(req, res, next) {
    var postId = req.params.postId;
    var author = req.session.user._id;
    var ip = req.ip.match(/\d+\.\d+\.\d+\.\d+/);
    PostModel.getRawPostById(postId)
        .then(function(post) {
            if (!post) {
                throw new Error('该文章不存在');
            }
            if (author.toString() !== post.author._id.toString()) {
                throw new Error('权限不足');
            }
            res.render('edit', {
                post: post,
                ip: ip
            });
        })
        .catch(next);
});

// POST /posts/:postId/edit 更新一篇文章
router.post('/:postId/edit', checkLogin, function(req, res, next) {
    //通过占位符获取文章ID
    var postId = req.params.postId;
    //从session中获取用户ID
    var author = req.session.user._id;
    //获取修改页面表格传来的 title,content 的数据
    var title = req.fields.title;
    var content = req.fields.content;

    PostModel.updatePostById(postId, author, { title: title, content: content })
        .then(function() {
            req.flash('success', '编辑文章成功');
            // 编辑成功后跳转到上一页
            res.redirect(`/posts/${postId}`);
        })
        .catch(next);
});

// GET /posts/:postId/remove 删除一篇文章
router.get('/:postId/remove', checkLogin, function(req, res, next) {
    var postId = req.params.postId;
    var author = req.session.user._id;

    if (req.session.user.identity.toString() === 'admin') {
        PostModel.admindelPostById(postId)
            .then(function() {
                req.flash('success', '删除文章成功');
                // 删除成功后跳转到主页
                res.redirect('/posts');
            })
            .catch(next);
    } else {
        PostModel.delPostById(postId, author)
            .then(function() {
                req.flash('success', '删除文章成功');
                // 删除成功后跳转到主页
                res.redirect('/posts');
            })
            .catch(next);
    }
});

// GET /posts/:postId/top 置顶一篇文章
router.get('/:postId/top', checkAdmin, function(req, res, next) {
    var postId = req.params.postId;
    var author = req.session.user._id;

    PostModel.admintopPostById(postId)
        .then(function() {
            req.flash('success', '置顶文章成功');
            // 删除成功后跳转到主页
            res.redirect('/posts');
        })
        .catch(next);
});

// GET /posts/:postId/untop 取消置顶一篇文章
router.get('/:postId/untop', checkAdmin, function(req, res, next) {
    var postId = req.params.postId;
    var author = req.session.user._id;

    PostModel.untopPostById(postId)
        .then(function() {
            req.flash('success', '取消置顶文章成功');
            // 删除成功后跳转到主页
            res.redirect('/posts');
        })
        .catch(next);
});

// POST /posts/:postId/comment 创建一条留言
router.post('/:postId/comment', checkLogin, function(req, res, next) {
    var author = req.session.user._id;
    var postId = req.params.postId;
    var content = req.fields.content;
    var comment = {
        author: author,
        postId: postId,
        content: content
    };

    CommentModel.create(comment)
        .then(function() {
            req.flash('success', '留言成功');
            // 留言成功后跳转到上一页
            res.redirect('back');
        })
        .catch(next);
});

// GET /posts/:postId/comment/:commentId/remove 删除一条留言
router.get('/:postId/comment/:commentId/remove', checkLogin, function(req, res, next) {
    var commentId = req.params.commentId;
    var author = req.session.user._id;

    if (req.session.user.identity.toString() === 'admin') {
        CommentModel.admindelCommentById(commentId)
            .then(function() {
                req.flash('success', '删除留言成功');
                // 删除成功后跳转到上一页
                res.redirect('back');
            })
            .catch(next);
    } else {
        CommentModel.delCommentById(commentId, author)
            .then(function() {
                req.flash('success', '删除留言成功');
                // 删除成功后跳转到上一页
                res.redirect('back');
            })
            .catch(next);
    }
});

module.exports = router;