const firebase = window.firebase;
const firebaseConfig = {
    apiKey: 'AIzaSyAnW7l5Bun9tFJSaZUpkOwWyWmZgs1ejf0',
    authDomain: 'prajwal-s-self-attendance.firebaseapp.com',
    projectId: 'prajwal-s-self-attendance',
    storageBucket: 'prajwal-s-self-attendance.firebasestorage.app',
    messagingSenderId: '963412196516',
    appId: '1:963412196516:web:b2a7d74e6e1487b91c7a31',
    measurementId: 'G-NGY734E26J'
};

firebase.initializeApp(firebaseConfig);
firebase.analytics();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
const db = firebase.firestore();

const info = document.getElementById("info-giver");
const resultImage = document.getElementById("resultImage");
const historyContainer = document.getElementById("imageHistory");
const apifield = document.getElementById("apis");
const imagestoreapifield = document.getElementById("imageStoreApi");
const dbtn = document.getElementById("downloadbtn");
const authToggleBtn = document.getElementById("authToggleBtn");
const userInfo = document.getElementById("userInfo");
const userEmail = document.getElementById("userEmail");
const userName = document.getElementById("userName");
const userPhoto = document.getElementById("userPhoto");
const promptInput = document.getElementById("promptInput");

const website = "https://api.stability.ai/v2beta/stable-image/generate/core";
let createdimagesuntilnow = {};

let current_user = null;
let current_user_uid = null;

auth.onAuthStateChanged(user => {
    if (user) {
        authToggleBtn.textContent = "Sign Out";
        authToggleBtn.onclick = () => auth.signOut();

        // Display user info
        userInfo.style.display = "flex";
        userEmail.textContent = user.email || "No email";
        userName.textContent = user.displayName || "Anonymous";
        userPhoto.src = user.photoURL || "https://www.gravatar.com/avatar/?d=mp";

        current_user = user;
        current_user_uid = user.uid;

        // Load image history
        retrieve();
    } else {
        // Sign-in trigger
        authToggleBtn.textContent = "Sign In";
        authToggleBtn.onclick = () => firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider())
        .catch(error => { alert(`❌ Error signing in user: ${error}`)});

        current_user = null;
        current_user_uid = null;
        
        dbtn.style.display = "none";
        userPhoto.src = "https://www.gravatar.com/avatar/?d=mp";
        userInfo.style.display = "none";
        userEmail.textContent = "";
        userName.textContent = "";

        // Clear form & history
        promptInput.value = "";
        apifield.value = "";
        imagestoreapifield.value = "";
        info.textContent = "";
        info.style.display = "none";
        createdimagesuntilnow = {};
        historyContainer.innerHTML = "<h2>Please sign in to view your generated images history.</h2>";
        alert("❌ User signed out. Signing you in!");
        authToggleBtn.click();
    }
    // Hide image and download until generated
    resultImage.style.display = "none";
    dbtn.style.display = "none";
    // Reset image & UI
    resultImage.src = "";
    resultImage.style.display = "none";
});

document.getElementById("promptForm").onsubmit = async function (e) {
    e.preventDefault();
    if (!current_user || !current_user_uid) {
        alert("❌ User not authenticated. Please sign in to generate images.");
        return;
    }
    document.getElementById("authToggleBtn").disabled = true;
    document.getElementById("generateButton").disabled = true;

    const prompt = document.getElementById("promptInput").value;
    const startTime = performance.now();

    resultImage.style.display = "none";
    resultImage.src = "";
    dbtn.style.display = "none";

    info.textContent = `Generating image with prompt: ${prompt} ...`;
    info.style.display = "block";
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("output_format", "png");

    try {
        const response = await fetch(website, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apifield.value}`,
                "Accept": "application/json"
            },
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.image) {
            // Upload to ImgBB
            const imgbbURL = `https://api.imgbb.com/1/upload?key=${imagestoreapifield.value}`;

            const uploadData = new FormData();
            uploadData.append("image", data.image); // no need to convert to Blob

            const uploadResponse = await fetch(imgbbURL, {
                method: "POST",
                body: uploadData
            });

            const uploadResult = await uploadResponse.json();
            if (!uploadResponse.ok || !uploadResult.data?.url) {
                throw new Error("❌ Failed to upload image to ImgBB");
            }

            const downloadURL = uploadResult.data.url;
            const durationSeconds = ((performance.now() - startTime) / 1000).toFixed(5);
            const timestamp = new Date();

            // Display image
            resultImage.src = downloadURL;
            resultImage.style.display = "block";
            dbtn.style.display = "block";
            dbtn.onclick = async () => {
                try {
                    // Fetch the image as binary data
                    const response = await fetch(downloadURL);
                    if (!response.ok) throw new Error("Failed to fetch image");

                    const blob = await response.blob();

                    // Create a temporary object URL for the blob
                    const blobUrl = URL.createObjectURL(blob);

                    // Create download link
                    const link = document.createElement("a");
                    link.href = blobUrl;

                    // Create safe filename
                    const timestampStr = new Date().toISOString().replace(/[:.]/g, "-");
                    link.download = `generated_image_${timestampStr}.png`;

                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    // Revoke the object URL to release memory
                    URL.revokeObjectURL(blobUrl);
                } catch (err) {
                    console.error(`❌ Download failed: ${err}`);
                    alert(`Error downloading image : ${err}. Check console for details.`);
                }
            };

            info.textContent = `Image generated successfully with prompt: ${prompt}. Time taken: ${durationSeconds} seconds`;

            // Save to imageLinks dictionary
            const key = `Prompt #${Object.keys(createdimagesuntilnow).length + 1}`;
            createdimagesuntilnow[key] = {
                prompt: prompt,
                link: downloadURL,
                time: durationSeconds,
                createdAt: timestamp.toLocaleString()
            };
            save();
        } else {
            console.error(`Error response: ${JSON.stringify(data)}`);
            info.textContent = `Error: ${data.errors || "Failed to generate image"}. See console for details.`;
        }

    } catch (error) {
        console.error(`Fetch error: ${error}`);
        info.textContent = `Network error: ${error || "Unexpected issue"}. See console for details.`;
    } finally {
        document.getElementById("authToggleBtn").disabled = false;
        document.getElementById("generateButton").disabled = false;
    }
};

function display() {
    if (!createdimagesuntilnow || Object.keys(createdimagesuntilnow).length === 0) {
        historyContainer.innerHTML = "<h2>No Images Generated Yet</h2>";
        return;
    }

    historyContainer.innerHTML = "<h2>History of Generated Images:</h2>";

    // Sort keys numerically based on "Prompt #" format
    const sortedKeys = Object.keys(createdimagesuntilnow).sort((a, b) => {
        const numA = parseInt(a.replace(/[^\d]/g, ""));
        const numB = parseInt(b.replace(/[^\d]/g, ""));
        return numB - numA; // Sort in descending order
    });

    sortedKeys.forEach(entryKey => {
        const value = createdimagesuntilnow[entryKey];
        historyContainer.innerHTML += `
            <div class="image-entry">
                <h3><strong>${entryKey}</strong> : ${value.prompt}</h3>
                <h3><strong>Link</strong> : <a href="${value.link}" target="_blank">${value.link}</a></h3>
                <h3><strong>Time Taken</strong> : ${value.time} seconds</h3>
                <h3><strong>Image generated at</strong> : ${value.createdAt}</h3>
            </div>
        `;
    });
}

function save() {
    if (!current_user || !current_user_uid) return;
    db.collection('ibm_projects').doc(current_user_uid)
        .set({
            user_generated_images: createdimagesuntilnow,
            user_api_key: apifield.value,
            image_store_api: imagestoreapifield.value
        }, { merge: true })
        .then(() => {
            display();
        })
        .catch((error) => {
            alert(`❌ Error saving user data: ${error.message}`);
        });
}

function retrieve() {
    if (!current_user || !current_user_uid) return;
    const docRef = db.collection('ibm_projects').doc(current_user_uid);
    docRef.get()
        .then(snap => {
            if (snap.exists) {
                const data = snap.data();
                createdimagesuntilnow = data.user_generated_images || {};
                if (data.user_api_key && data.image_store_api) {
                    apifield.value = data.user_api_key;
                    imagestoreapifield.value = data.image_store_api;
                } else {
                    const docRef0 = db.collection('ibm_projects').doc('Current API Key');
                    docRef0.get()
                        .then(snap0 => {
                            const data0 = snap0.data();
                            docRef.set({
                                user_api_key: data0.API,
                                image_store_api: data0.ImageStoreAPI
                            }, { merge: true });
                            retrieve();
                        })
                        .catch(error => {
                            alert(`❌ Error fetching API key: ${error}`);
                        });
                }
            } else {
                docRef.set({ user_generated_images: {} }, { merge: true })
                    .then(() => retrieve())
                    .catch(error => {
                        alert(`❌ Error creating user document: ${error.message}`);
                    });
            }
        })
        .catch(error => {
            alert(`❌ Error fetching user data: ${error.message}`);
        })
        .finally(() => {
            display();
        });
}
