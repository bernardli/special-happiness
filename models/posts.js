var marked = require('marked');

var markdown = require("markdown").markdown;

var Post = require('../lib/mongo').Post;

var CommentModel = require('./comments');

var config = require('config-lite');

// 给 post 添加留言数 commentsCount
Post.plugin('addCommentsCount', {
    afterFind: function(posts) {
        return Promise.all(posts.map(function(post) {
            return CommentModel.getCommentsCount(post._id).then(function(commentsCount) {
                post.commentsCount = commentsCount;
                return post;
            });
        }));
    },
    afterFindOne: function(post) {
        if (post) {
            return CommentModel.getCommentsCount(post._id).then(function(count) {
                post.commentsCount = count;
                return post;
            });
        }
        return post;
    }
});

// 将 post 的 content 从 markdown 转换成 html
Post.plugin('contentToHtml', {
    afterFind: function(posts) {
        return posts.map(function(post) {
            //post.content = marked(post.content);
            post.content = marked(post.content);
            return post;
        });
    },
    afterFindOne: function(post) {
        if (post) {
            // post.content = marked(post.content);
            post.content = marked(post.content);
        }
        return post;
    }
});

// ,
Post.plugin('pre', {
    afterFind: function(posts) {
        return posts.map(function(post) {
            //post.content = marked(post.content);
            post.content = post.content.replace(/<\/?.+?>/g, ""); //去除 HTML 标签
            post.content = post.content.replace(/[ ]/g, ""); //去空格
            post.content = post.content.replace(/[\r\n]/g, " "); //回车变空格
            post.content = post.content.substring(0, 100); //获取前100个字符
            return post;
        });
    },
    afterFindOne: function(post) {
        if (post) {
            // post.content = marked(post.content);
            post.content = post.content.replace(/<\/?.+?>/g, ""); //去除 HTML 标签
            post.content = post.content.replace(/[ ]/g, ""); //去空格
            post.content = post.content.replace(/[\r\n]/g, " "); //回车变空格
            post.content = post.content.substring(0, 100); //获取前100个字符
        }
        return post;
    }
});

module.exports = {
    // 创建一篇文章
    create: function create(post) {
        return Post.create(post).exec();
    },

    // 通过文章 id 获取一篇html文章
    getPostById: function getPostById(postId) {
        return Post
            .findOne({ _id: postId })
            .populate({ path: 'author', model: 'User' })
            .addCreatedAt()
            .addCommentsCount()
            .contentToHtml()
            .exec();
    },

    //获取搜索结果或用户文章
    getresults: function getresults(author, page, search) {
        var query = {};
        if (author) {
            query.author = author;
        } else if (search) {
            query = { $or: ([{ author: { $regex: String(search) } }, { title: { $regex: String(search) } }, { content: { $regex: String(search) } }]) };
        }
        return Post
            .find(query)
            .skip((page - 1) * 5)
            .limit(5)
            .populate({ path: 'author', model: 'User' })
            .sort({ _id: -1 })
            .addCreatedAt()
            .addCommentsCount()
            .contentToHtml()
            .pre()
            .exec();
    },

    //获取最新文章的摘要
    getrecentPosts: function getrecentPosts(page) {
        return Post
            .find({ top: 0 })
            .skip((page - 1) * 5)
            .limit(5)
            .populate({ path: 'author', model: 'User' })
            .sort({ _id: -1 })
            .addCreatedAt()
            .addCommentsCount()
            .contentToHtml()
            .pre()
            .exec();
    },

    //获取置顶文章的摘要
    gettopPosts: function gettopPosts() {
        return Post
            .find({ top: 1 })
            .populate({ path: 'author', model: 'User' })
            .sort({ _id: -1 })
            .addCreatedAt()
            .addCommentsCount()
            .contentToHtml()
            .pre()
            .exec();
    },

    // 通过文章 id 给 pv 加 1
    incPv: function incPv(postId, w_pv) {
        return Post
            .update({ _id: postId }, { $inc: { pv: parseInt(w_pv) } })
            .exec();
    },

    // 通过文章 id 获取一篇原生markdown文章
    getRawPostById: function getRawPostById(postId) {
        return Post
            .findOne({ _id: postId })
            .populate({ path: 'author', model: 'User' })
            .exec();
    },

    // 通过用户 id 和文章 id 更新一篇文章
    updatePostById: function updatePostById(postId, author, data) {
        return Post.update({ author: author, _id: postId }, { $set: data }).exec();
    },

    // 通过用户 id 和文章 id 删除一篇文章
    delPostById: function delPostById(postId, author) {
        return Post.remove({ author: author, _id: postId })
            .exec()
            .then(function(res) {
                // 文章删除后，再删除该文章下的所有留言
                if (res.result.ok && res.result.n > 0) {
                    return CommentModel.delCommentsByPostId(postId);
                }
            });
    },

    //管理员删除文章
    admindelPostById: function admindelPostById(postId) {
        return Post.remove({ _id: postId })
            .exec()
            .then(function(res) {
                // 文章删除后，再删除该文章下的所有留言
                if (res.result.ok && res.result.n > 0) {
                    return CommentModel.delCommentsByPostId(postId);
                }
            });
    },

    //管理员置顶或取消置顶文章
    admintopPostById: function admintopPostById(postId,t) {
        return Post.update({ _id: postId }, { $set: { top: t } }).exec();
    }
};