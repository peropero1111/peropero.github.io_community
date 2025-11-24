// Firebase 설정 객체
        var firebaseConfig = {
            apiKey: "peropero-d58a1.firebaseapp.com",
            authDomain: "peropero-d58a1.firebaseapp.com",
            databaseURL: "https://peropero-d58a1-default-rtdb.firebaseio.com",
            projectId: "peropero-d58a1",
            storageBucket: "peropero-d58a1.appspot.com",
            messagingSenderId: "507483833368",
            appId: "1:507483833368:web:342ce39bcfb6de1acfaf6d"
        };
        // Firebase 초기화
        firebase.initializeApp(firebaseConfig);
        var database = firebase.database();
        var storage = firebase.storage();

        // 모드 전환 함수
        function toggleMode() {
            const currentTheme = document.documentElement.getAttribute("data-theme");
            const newTheme = currentTheme === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", newTheme);
            localStorage.setItem("theme", newTheme);
        }

        // 페이지 로드 시 저장된 테마 적용
        document.addEventListener("DOMContentLoaded", function () {
            const savedTheme = localStorage.getItem("theme");
            if (savedTheme) {
                document.documentElement.setAttribute("data-theme", savedTheme);
            }
            loadPosts(); // 페이지 로드 시 기존 게시물 불러오기
        });

        // 게시물 추가 함수
        function addPost(nickname, content, fileUrl, fileType) {
            const newPostKey = database.ref().child('posts').push().key;
            database.ref('posts/' + newPostKey).set({
                nickname: nickname,
                content: content,
                fileUrl: fileUrl || null,
                fileType: fileType || null,
                likes: 0,
                dislikes: 0
            });
        }

        // 게시물 작성 폼 제출 이벤트 리스너
        document.getElementById('postForm').addEventListener('submit', function (event) {
            event.preventDefault();
            const nickname = document.getElementById('nickname').value;
            const content = document.getElementById('content').value;
            const file = document.getElementById('file').files[0];

            if (file) {
                const storageRef = storage.ref('uploads/' + file.name);
                storageRef.put(file).then(function (snapshot) {
                    snapshot.ref.getDownloadURL().then(function (downloadURL) {
                        addPost(nickname, content, downloadURL, file.type);
                        document.getElementById('postForm').reset();
                    });
                });
            } else {
                addPost(nickname, content, null, null);
                document.getElementById('postForm').reset();
            }
        });

        // 게시물 불러오기 함수
        function loadPosts() {
            const postsRef = database.ref('posts');
            postsRef.on('value', function (snapshot) {
                const postsList = document.getElementById('posts');
                postsList.innerHTML = '';
                snapshot.forEach(function (childSnapshot) {
                    const postData = childSnapshot.val();
                    postData.id = childSnapshot.key;
                    displayPost(postData);
                });
            });
        }

        // 게시물 필터링 함수
        function filterPosts() {
            const postsRef = database.ref('posts').orderByChild('likes').startAt(5);
            postsRef.once('value', function (snapshot) {
                const postsList = document.getElementById('posts');
                postsList.innerHTML = '';
                snapshot.forEach(function (childSnapshot) {
                    const postData = childSnapshot.val();
                    postData.id = childSnapshot.key;
                    displayPost(postData);
                });
            });
        }

        // 게시물 DOM에 표시하는 함수
        function displayPost(postData) {
            const postList = document.getElementById('posts');
            const li = document.createElement('li');
            li.innerHTML = `
                <strong>${postData.nickname}</strong>: ${postData.content}
                ${generatePreview(postData.fileUrl, postData.fileType)}
                <p>추천 수: ${postData.likes} | 비추천 수: ${postData.dislikes}</p>
                <button onclick="likePost('${postData.id}', '${postData.nickname}')">추천</button>
                <button onclick="dislikePost('${postData.id}', '${postData.nickname}')">비추천</button>
                <h4>댓글</h4>
                <ul id="comments-${postData.id}"></ul>
                <form onsubmit="addComment('${postData.id}', this); return false;">
                    <input type="text" name="commentNickname" placeholder="닉네임" required>
                    <input type="text" name="commentContent" placeholder="댓글 입력" required>
                    <button type="submit">댓글 작성</button>
                </form>
            `;
            postList.prepend(li);
            loadComments(postData.id);
        }

        // 댓글 저장 함수
        function addComment(postId, form) {
            const commentNickname = form.commentNickname.value;
            const commentContent = form.commentContent.value;

            if (commentNickname && commentContent) {
                const newCommentKey = database.ref().child(`posts/${postId}/comments`).push().key;
                database.ref(`posts/${postId}/comments/${newCommentKey}`).set({
                    nickname: commentNickname,
                    content: commentContent,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });

                form.commentNickname.value = '';
                form.commentContent.value = '';
            }
            return false;
        }

        // 댓글 불러오기 함수
        function loadComments(postId) {
            const commentsRef = database.ref(`posts/${postId}/comments`);
            commentsRef.on('value', function (snapshot) {
                const commentsList = document.getElementById(`comments-${postId}`);
                commentsList.innerHTML = '';

                snapshot.forEach(function (childSnapshot) {
                    const comment = childSnapshot.val();
                    const li = document.createElement('li');
                    li.classList.add('comment');
                    li.innerHTML = `<strong>${comment.nickname}:</strong> ${comment.content}`;
                    commentsList.appendChild(li);
                });
            });
        }

        // 미디어 미리보기 생성 함수
        function generatePreview(fileUrl, fileType) {
            if (!fileUrl) return '';
            if (fileType.startsWith('image/')) {
                return `<img src="${fileUrl}" style="max-width: 100%; height: auto;" alt="Image Preview">`;
            } else if (fileType.startsWith('audio/')) {
                return `<audio controls><source src="${fileUrl}" type="${fileType}">Your browser does not support the audio element.</audio>`;
            } else if (fileType.startsWith('video/')) {
                return `<video controls style="max-width: 100%; height: auto;"><source src="${fileUrl}" type="${fileType}">Your browser does not support the video element.</video>`;
            }
            return '';
        }

        // 추천 및 비추천 함수 (한 번만 누를 수 있게 구현)
        function likePost(postId, nickname) {
            const postRef = database.ref('posts/' + postId + '/likedUsers/' + nickname);
            postRef.once('value', function (snapshot) {
                if (!snapshot.exists()) {
                    // 사용자가 이미 추천하지 않은 경우 추천 가능
                    database.ref('posts/' + postId + '/likes').transaction(function (likes) {
                        return (likes || 0) + 1;
                    });
                    postRef.set(true); // 사용자가 추천한 것으로 저장
                } else {
                    alert('이미 추천을 했습니다.');
                }
            });
        }

        function dislikePost(postId, nickname) {
            const postRef = database.ref('posts/' + postId + '/dislikedUsers/' + nickname);
            postRef.once('value', function (snapshot) {
                if (!snapshot.exists()) {
                    // 사용자가 이미 비추천하지 않은 경우 비추천 가능
                    database.ref('posts/' + postId + '/dislikes').transaction(function (dislikes) {
                        return (dislikes || 0) + 1;
                    });
                    postRef.set(true); // 사용자가 비추천한 것으로 저장
                } else {
                    alert('이미 비추천을 했습니다.');
                }
            });
        }