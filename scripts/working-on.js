(() => {
  const gallery = document.getElementById("project-gallery");
  if (!gallery) return;

  const createProjectCard = (project) => {
    const card = document.createElement("article");
    card.className = "card";

    const image = document.createElement("img");
    image.src = project.image;
    image.alt = project.imageAlt || project.title;
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

  fetch("/content/projects.json", {
    headers: { Accept: "application/json" },
  })
    .then((response) => {
      if (!response.ok) throw new Error("Project data could not be loaded.");
      return response.json();
    })
    .then((data) => {
      if (!Array.isArray(data.projects) || data.projects.length === 0) return;
      gallery.replaceChildren(...data.projects.map(createProjectCard));
    })
    .catch((error) => console.error("Could not load working-on projects:", error));
})();
