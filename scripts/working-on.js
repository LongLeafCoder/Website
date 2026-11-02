(() => {
  const gallery = document.getElementById("project-gallery");
  const slideshow = document.getElementById("project-slideshow");
  if (!gallery || !slideshow) return;

  const slideshowImage = slideshow.querySelector(".project-slideshow-image");
  const slideshowTitle = document.getElementById("project-slideshow-title");
  const slideshowCount = slideshow.querySelector("[data-slideshow-count]");
  const closeButton = slideshow.querySelector("[data-slideshow-close]");
  const previousButton = slideshow.querySelector("[data-slideshow-previous]");
  const nextButton = slideshow.querySelector("[data-slideshow-next]");
  let activeImageIndex = 0;
  let openingImage;

  const getProjectImages = () =>
    Array.from(document.querySelectorAll(".feature > img, #project-gallery .card img"));

  const getImageTitle = (image) =>
    image.dataset.slideshowTitle ||
    image.closest(".card")?.querySelector("h2")?.textContent ||
    image.alt;

  const prepareProjectImages = () => {
    getProjectImages().forEach((image) => {
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `Open ${getImageTitle(image)} in slideshow`);
    });
  };

  const showImage = (index) => {
    const images = getProjectImages();
    if (images.length === 0) return;

    activeImageIndex = (index + images.length) % images.length;
    const image = images[activeImageIndex];
    slideshowImage.src = image.currentSrc || image.src;
    slideshowImage.alt = image.alt;
    slideshowTitle.textContent = getImageTitle(image);
    slideshowCount.textContent = `${activeImageIndex + 1} / ${images.length}`;
  };

  const openSlideshow = (image) => {
    const images = getProjectImages();
    openingImage = image;
    showImage(images.indexOf(image));
    slideshow.showModal();
    closeButton.focus();
  };

  prepareProjectImages();

  document.addEventListener("click", (event) => {
    const image = event.target.closest?.(".feature > img, #project-gallery .card img");
    if (image) openSlideshow(image);
  });

  document.addEventListener("keydown", (event) => {
    if (slideshow.open) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showImage(activeImageIndex - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        showImage(activeImageIndex + 1);
      }
      return;
    }

    const image = event.target.closest?.(".feature > img, #project-gallery .card img");
    if (image && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openSlideshow(image);
    }
  });

  previousButton.addEventListener("click", () => showImage(activeImageIndex - 1));
  nextButton.addEventListener("click", () => showImage(activeImageIndex + 1));
  closeButton.addEventListener("click", () => slideshow.close());

  slideshow.addEventListener("click", (event) => {
    if (event.target === slideshow) slideshow.close();
  });

  slideshow.addEventListener("close", () => {
    if (openingImage?.isConnected) openingImage.focus();
  });

  const createProjectCard = (project) => {
    const card = document.createElement("article");
    card.className = "card";

    const image = document.createElement("img");
    image.src = project.image;
    image.alt = project.imageAlt || project.title;
    image.dataset.slideshowTitle = project.title;
    image.loading = "lazy";
    image.decoding = "async";

    const copy = document.createElement("div");
    copy.className = "card-copy";

    const category = document.createElement("div");
    category.className = "mono";
    category.textContent = project.category || "Woodworking";

    const title = document.createElement("h2");
    title.textContent = project.title;

    const description = document.createElement("p");
    description.textContent = project.description;

    copy.append(category, title, description);
    card.append(image, copy);
    return card;
  };

  const projectDate = (project) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(project.dateAdded || "")) return null;

    const timestamp = Date.parse(`${project.dateAdded}T00:00:00Z`);
    if (
      !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0, 10) !== project.dateAdded
    ) {
      return null;
    }

    return timestamp;
  };

  const sortProjectsNewestFirst = (projects) =>
    projects
      .map((project, index) => ({ project, index, timestamp: projectDate(project) }))
      .sort((left, right) => {
        if (left.timestamp === null && right.timestamp === null) {
          return left.index - right.index;
        }
        if (left.timestamp === null) return 1;
        if (right.timestamp === null) return -1;
        return right.timestamp - left.timestamp || left.index - right.index;
      })
      .map(({ project }) => project);

  fetch("/content/projects.json", {
    headers: { Accept: "application/json" },
  })
    .then((response) => {
      if (!response.ok) throw new Error("Project data could not be loaded.");
      return response.json();
    })
    .then((data) => {
      if (!Array.isArray(data.projects) || data.projects.length === 0) return;
      const sortedProjects = sortProjectsNewestFirst(data.projects);
      gallery.replaceChildren(...sortedProjects.map(createProjectCard));
      prepareProjectImages();
    })
    .catch((error) => console.error("Could not load working-on projects:", error));
})();
