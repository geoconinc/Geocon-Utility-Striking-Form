// Shared behaviour for the injury and offensive behavior forms. The utility
// strike form is unchanged and still uses script.js.
//
// Forms drive this script through markup:
//   - a hidden `reportType` input selects the server-side report definition
//   - `data-show-when="name:value"` reveals a field only while that option is picked

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form[data-report]");
  if (!form) return;

  const submitBtn = form.querySelector(".submit-btn");
  const successOverlay = document.getElementById("successOverlay");

  initConditionals(form);
  const getPhotos = initPhotoUpload(form);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const firstInvalid = findFirstInvalidField(form);
    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    submitReport(gatherFormData(form, getPhotos()));
  });

  const revalidate = (event) => {
    const wrapper = event.target.closest(".field");
    if (wrapper && wrapper.classList.contains("invalid")) validateField(event.target);
  };
  form.addEventListener("input", revalidate);
  form.addEventListener("change", revalidate);

  async function submitReport(formData) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";

    try {
      // netlify.toml rewrites this to the function in production, and server.js
      // serves it directly in local development, so one URL works in both.
      const res = await fetch("/api/submit-report", { method: "POST", body: formData });
      const text = await res.text();

      let result;
      try {
        result = text ? JSON.parse(text) : {};
      } catch (err) {
        console.error("Server response was not JSON. Status:", res.status, "Body:", text);
        throw new Error(
          res.status === 413
            ? "Your photos are too large to upload. Please remove some and try again."
            : "Server returned an invalid response. Check the browser console (F12) for details."
        );
      }

      if (!res.ok || !result.success) throw new Error(result.error || "Server returned an error.");

      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
      successOverlay.classList.add("visible");
    } catch (err) {
      alert("Submission failed: " + err.message + "\nPlease try again.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  }
});

function initConditionals(form) {
  const conditionals = Array.from(form.querySelectorAll("[data-show-when]"));
  if (conditionals.length === 0) return;

  const update = () => {
    for (const element of conditionals) {
      const [name, value] = element.dataset.showWhen.split(":");
      const trigger = form.querySelector(`input[name="${name}"][value="${value}"]`);
      element.style.display = trigger && trigger.checked ? "block" : "none";
    }
  };

  form.addEventListener("change", update);
  update();
}

function initPhotoUpload(form) {
  const uploadArea = form.querySelector("#uploadArea");
  if (!uploadArea) return () => [];

  const photoInput = form.querySelector("#photoUpload");
  const photoPreview = form.querySelector("#photoPreview");
  const photos = [];

  const addFiles = (fileList) => {
    for (const file of fileList) {
      if (!file.type.startsWith("image/")) continue;
      photos.push(file);
      photoPreview.appendChild(createThumbnail(file, photos));
    }
  };

  uploadArea.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadArea.classList.add("dragover");
  });
  uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("dragover"));
  uploadArea.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadArea.classList.remove("dragover");
    addFiles(event.dataTransfer.files);
  });

  photoInput.addEventListener("change", () => {
    addFiles(photoInput.files);
    photoInput.value = "";
  });

  return () => photos;
}

function createThumbnail(file, photos) {
  const objectUrl = URL.createObjectURL(file);
  const thumb = document.createElement("div");
  thumb.className = "photo-thumb";
  thumb.innerHTML =
    `<img src="${objectUrl}" alt="Photo">` +
    `<button type="button" class="remove-photo" title="Remove">&times;</button>`;

  thumb.querySelector(".remove-photo").addEventListener("click", () => {
    const index = photos.indexOf(file);
    if (index !== -1) photos.splice(index, 1);
    URL.revokeObjectURL(objectUrl);
    thumb.remove();
  });

  return thumb;
}

function findFirstInvalidField(form) {
  let firstInvalid = null;

  for (const wrapper of form.querySelectorAll(".field.required")) {
    const target =
      wrapper.querySelector('input[type="radio"], input[type="checkbox"]') ||
      wrapper.querySelector("input, textarea, select");
    if (!target) continue;
    if (!validateField(target) && !firstInvalid) firstInvalid = wrapper;
  }

  return firstInvalid;
}

function validateField(field) {
  const wrapper = field.closest(".field");
  if (!wrapper || !wrapper.classList.contains("required")) return true;
  // A hidden conditional field can't be required.
  if (wrapper.offsetParent === null) return true;

  let valid;
  let message = "This field is required.";

  if (field.type === "radio") {
    valid = !!wrapper.querySelector('input[type="radio"]:checked');
  } else if (field.type === "checkbox") {
    valid = wrapper.querySelectorAll('input[type="checkbox"]:checked').length > 0;
    message = "Please select at least one option.";
  } else {
    valid = field.value.trim() !== "";
  }

  wrapper.classList.toggle("invalid", !valid);
  const errorEl = wrapper.querySelector(".error-msg");
  if (errorEl) errorEl.textContent = valid ? "" : message;

  return valid;
}

function gatherFormData(form, photos) {
  const data = new FormData();

  for (const element of form.querySelectorAll("[name]")) {
    if (element.type === "file") continue;
    if ((element.type === "radio" || element.type === "checkbox") && !element.checked) continue;

    const value = element.value.trim();
    if (value) data.append(element.name, value);
  }

  for (const photo of photos) data.append("photos", photo);

  return data;
}
