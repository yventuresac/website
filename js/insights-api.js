/* ──────────────────────────────────────────────────────────────
   Y-VENTURES Insights 게시판 API (Supabase)
   필요: supabase-js CDN → auth-config.js → auth.js → 이 파일
   ────────────────────────────────────────────────────────────── */
(function () {
  if (!window.yvAuth) { console.error("[yvInsights] yvAuth 필요"); return; }
  var db = window.yvAuth.client;
  var PAGE_SIZE = 10;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* 렌더 전 최소 방어: script/이벤트핸들러 제거 */
  function sanitizeHtml(html) {
    var t = document.createElement("template");
    t.innerHTML = html || "";
    t.content.querySelectorAll("script, iframe[src^='javascript'], object, embed").forEach(function (n) { n.remove(); });
    t.content.querySelectorAll("*").forEach(function (el) {
      [].slice.call(el.attributes).forEach(function (a) {
        if (/^on/i.test(a.name)) el.removeAttribute(a.name);
        if ((a.name === "href" || a.name === "src") && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
      });
    });
    return t.innerHTML;
  }

  window.yvInsights = {
    PAGE_SIZE: PAGE_SIZE,
    esc: esc,
    sanitizeHtml: sanitizeHtml,

    /* 목록 (좋아요·댓글 수 포함) */
    async listPosts(page) {
      var from = (page - 1) * PAGE_SIZE;
      var r = await db
        .from("insight_posts")
        .select("id, board_no, title, author_name, created_at, view_count, insight_likes(count), insight_comments(count)", { count: "exact" })
        .order("board_no", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (r.error) throw r.error;
      return {
        total: r.count || 0,
        totalPages: Math.max(1, Math.ceil((r.count || 0) / PAGE_SIZE)),
        posts: (r.data || []).map(function (p) {
          return {
            id: p.id, no: p.board_no, title: p.title, author: p.author_name,
            date: (p.created_at || "").slice(0, 10), views: p.view_count,
            likes: (p.insight_likes && p.insight_likes[0] && p.insight_likes[0].count) || 0,
            comments: (p.insight_comments && p.insight_comments[0] && p.insight_comments[0].count) || 0
          };
        })
      };
    },

    /* 단건 (board_no 기준) */
    async getPost(no) {
      var r = await db
        .from("insight_posts")
        .select("id, board_no, title, author_name, author_id, content_html, created_at, view_count, insight_likes(count), insight_comments(count)")
        .eq("board_no", no)
        .maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    },

    async incrementView(postId) {
      try { await db.rpc("increment_insight_view", { p_post_id: postId }); } catch (e) {}
    },

    /* 좋아요 */
    async getMyLike(postId, userId) {
      if (!userId) return false;
      var r = await db.from("insight_likes").select("post_id").eq("post_id", postId).eq("user_id", userId).maybeSingle();
      return !!(r.data);
    },
    async toggleLike(postId, userId) {
      var liked = await this.getMyLike(postId, userId);
      if (liked) {
        var d = await db.from("insight_likes").delete().eq("post_id", postId).eq("user_id", userId);
        if (d.error) throw d.error;
        return false;
      }
      var i = await db.from("insight_likes").insert({ post_id: postId, user_id: userId });
      if (i.error) throw i.error;
      return true;
    },
    async likeCount(postId) {
      var r = await db.from("insight_likes").select("post_id", { count: "exact", head: true }).eq("post_id", postId);
      return r.count || 0;
    },

    /* 댓글 */
    async listComments(postId) {
      var r = await db.from("insight_comments")
        .select("id, user_id, author_name, body, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (r.error) throw r.error;
      return r.data || [];
    },
    async addComment(postId, user, body) {
      var name = (user.user_metadata && user.user_metadata.full_name) || user.email.split("@")[0];
      var r = await db.from("insight_comments").insert({ post_id: postId, user_id: user.id, author_name: name, body: body });
      if (r.error) throw r.error;
    },
    async deleteComment(commentId) {
      var r = await db.from("insight_comments").delete().eq("id", commentId);
      if (r.error) throw r.error;
    },

    /* 학회원 여부 (글 작성 권한) */
    async getMyProfile() {
      var user = await window.yvAuth.getUser();
      if (!user) return null;
      var r = await db.from("profiles").select("id, display_name, is_member, is_admin").eq("id", user.id).maybeSingle();
      return r.data ? Object.assign({ user: user }, r.data) : { user: user, is_member: false, is_admin: false, display_name: "" };
    },

    /* 글 등록 (board_no = max+1) */
    async createPost(user, title, contentHtml, authorName) {
      var m = await db.from("insight_posts").select("board_no").order("board_no", { ascending: false }).limit(1);
      var nextNo = ((m.data && m.data[0] && m.data[0].board_no) || 0) + 1;
      var r = await db.from("insight_posts").insert({
        board_no: nextNo, title: title, author_name: authorName,
        author_id: user.id, content_html: contentHtml
      }).select("board_no").single();
      if (r.error) throw r.error;
      return r.data.board_no;
    },

    /* 에디터 이미지 업로드 → 공개 URL */
    async uploadImage(file) {
      var ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      var path = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
      var up = await db.storage.from("insight-images").upload(path, file, { cacheControl: "31536000", upsert: false });
      if (up.error) throw up.error;
      return db.storage.from("insight-images").getPublicUrl(path).data.publicUrl;
    }
  };
})();
