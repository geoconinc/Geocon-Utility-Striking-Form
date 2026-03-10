document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("strikeForm");
  const locatorRadios = document.querySelectorAll('input[name="privateLocator"]');
  const locatorHiredGroup = document.getElementById("locatorHiredGroup");
  const locatorNotHiredGroup = document.getElementById("locatorNotHiredGroup");
  const uploadArea = document.getElementById("uploadArea");
  const photoInput = document.getElementById("photoUpload");
  const photoPreview = document.getElementById("photoPreview");
  const successOverlay = document.getElementById("successOverlay");
  const submitBtn = document.getElementById("submitBtn");

  let uploadedFiles = [];

  // ---- Conditional fields for Q12 ----
  locatorRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      const value = radio.value;
      locatorHiredGroup.style.display = value === "Yes" ? "block" : "none";
      locatorNotHiredGroup.style.display = value === "No" ? "block" : "none";
    });
  });

  // ---- Photo upload handling ----
  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("dragover");
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });

  photoInput.addEventListener("change", () => {
    handleFiles(photoInput.files);
    photoInput.value = "";
  });

  function handleFiles(fileList) {
    Array.from(fileList).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      uploadedFiles.push(file);
      renderThumbnail(file, uploadedFiles.length - 1);
    });
  }

  function renderThumbnail(file, index) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const thumb = document.createElement("div");
      thumb.className = "photo-thumb";
      thumb.dataset.index = index;
      thumb.innerHTML =
        `<img src="${e.target.result}" alt="Photo">` +
        `<button type="button" class="remove-photo" title="Remove">&times;</button>`;

      thumb.querySelector(".remove-photo").addEventListener("click", () => {
        uploadedFiles[index] = null;
        thumb.remove();
      });

      photoPreview.appendChild(thumb);
    };
    reader.readAsDataURL(file);
  }

  // ---- Validation ----
  function validateField(field) {
    const wrapper = field.closest(".field");
    if (!wrapper || !wrapper.classList.contains("required")) return true;

    let valid = true;
    let message = "This field is required.";

    if (field.type === "radio") {
      const checked = wrapper.querySelector('input[type="radio"]:checked');
      valid = !!checked;
    } else if (field.type === "checkbox") {
      const checked = wrapper.querySelectorAll('input[type="checkbox"]:checked');
      valid = checked.length > 0;
      message = "Please select at least one option.";
    } else {
      valid = field.value.trim() !== "";
    }

    const errorEl = wrapper.querySelector(".error-msg");
    if (!valid) {
      wrapper.classList.add("invalid");
      if (errorEl) errorEl.textContent = message;
    } else {
      wrapper.classList.remove("invalid");
      if (errorEl) errorEl.textContent = "";
    }

    return valid;
  }

  // ---- Form submission ----
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    let firstInvalid = null;
    let allValid = true;

    const requiredFields = form.querySelectorAll(".field.required");
    requiredFields.forEach((wrapper) => {
      const input =
        wrapper.querySelector("input:not([type='radio']):not([type='checkbox'])") ||
        wrapper.querySelector("textarea");
      const radios = wrapper.querySelectorAll('input[type="radio"]');
      const checkboxes = wrapper.querySelectorAll('input[type="checkbox"]');

      let valid;
      if (radios.length > 0) {
        valid = validateField(radios[0]);
      } else if (checkboxes.length > 0) {
        valid = validateField(checkboxes[0]);
      } else if (input) {
        valid = validateField(input);
      }

      if (!valid && !firstInvalid) {
        firstInvalid = wrapper;
        allValid = false;
      } else if (!valid) {
        allValid = false;
      }
    });

    if (!allValid) {
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const formData = gatherFormData();
    submitReport(formData);
  });

  function gatherFormData() {
    const data = new FormData();

    data.append("projectNumber", getValue("projectNumber"));
    data.append("projectName", getValue("projectName"));
    data.append("reporterName", getValue("reporterName"));
    data.append("projectManager", getValue("projectManager"));
    data.append("employeesOnSite", getValue("employeesOnSite"));
    data.append("strikeDate", getValue("strikeDate"));
    data.append("strikeTime", getValue("strikeTime"));
    data.append("clientContact", getValue("clientContact"));
    data.append("clientPhone", getValue("clientPhone"));
    data.append("digAlertTicket", getValue("digAlertTicket"));
    data.append("digAlertExplanation", getValue("digAlertExplanation"));

    const locator = form.querySelector('input[name="privateLocator"]:checked');
    data.append("privateLocator", locator ? locator.value : "");
    data.append("locatorSubcontractor", getValue("locatorSubcontractor"));
    data.append("locatorWhyNot", getValue("locatorWhyNot"));
    data.append("drillingSubcontractor", getValue("drillingSubcontractor"));

    const utilityTypes = Array.from(
      form.querySelectorAll('input[name="utilityType"]:checked')
    ).map((cb) => cb.value);
    data.append("utilityType", utilityTypes.join(", "));

    data.append("description", getValue("description"));

    uploadedFiles.filter(Boolean).forEach((file) => {
      data.append("photos", file);
    });

    return data;
  }

  function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  async function submitReport(formData) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || "Server returned an error.");
      }

      showSuccess();
    } catch (err) {
      alert("Submission failed: " + err.message + "\nPlease try again.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  }

  function showSuccess() {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
    successOverlay.classList.add("visible");
  }

  // Clear inline validation on input
  form.addEventListener("input", (e) => {
    const wrapper = e.target.closest(".field");
    if (wrapper && wrapper.classList.contains("invalid")) {
      validateField(e.target);
    }
  });

  form.addEventListener("change", (e) => {
    const wrapper = e.target.closest(".field");
    if (wrapper && wrapper.classList.contains("invalid")) {
      validateField(e.target);
    }
  });
});
