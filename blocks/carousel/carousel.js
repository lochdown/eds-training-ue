import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

function getCellText(cell) {
  if (!cell) return '';
  return cell.textContent.trim();
}

function getCellLink(cell) {
  if (!cell) return '';
  const anchor = cell.querySelector('a');
  if (anchor?.href) return anchor.href;
  return '';
}

function extractSlide(row) {
  const cells = [...row.children];
  const image = cells[0]?.querySelector('img');
  const title = getCellText(cells[1]);
  const description = getCellText(cells[2]);
  const ctaLinks = [...(cells[3]?.querySelectorAll('a') || [])].slice(0, 2);

  const primaryCtaText = ctaLinks[0]?.textContent.trim() || getCellText(cells[3]);
  const primaryCtaLink = ctaLinks[0]?.href || getCellLink(cells[4]);
  const secondaryCtaText = ctaLinks[1]?.textContent.trim() || getCellText(cells[5]);
  const secondaryCtaLink = ctaLinks[1]?.href || getCellLink(cells[6]);

  return {
    image,
    title,
    description,
    primaryCtaText,
    primaryCtaLink,
    secondaryCtaText,
    secondaryCtaLink,
  };
}

function createCta(text, href, variant) {
  if (!text || !href) return null;
  const cta = document.createElement('a');
  cta.className = `carousel-cta ${variant}`;
  cta.href = href;
  cta.textContent = text;
  return cta;
}

function createSlide(slideData, index, totalSlides) {
  const li = document.createElement('li');
  li.className = 'carousel-slide';
  li.setAttribute('role', 'group');
  li.setAttribute('aria-roledescription', 'slide');
  li.setAttribute('aria-label', `${index + 1} of ${totalSlides}`);

  const imageCol = document.createElement('div');
  imageCol.className = 'carousel-media';

  if (slideData.image) {
    const optimizedPicture = createOptimizedPicture(
      slideData.image.src,
      slideData.image.alt || slideData.title || 'Carousel image',
      false,
      [
        { width: '600' },
        { width: '1200' },
      ],
    );
    moveInstrumentation(slideData.image, optimizedPicture.querySelector('img'));
    imageCol.append(optimizedPicture);
  }

  const bodyCol = document.createElement('div');
  bodyCol.className = 'carousel-body';

  if (slideData.title) {
    const heading = document.createElement('h2');
    heading.className = 'carousel-title';
    heading.textContent = slideData.title;
    bodyCol.append(heading);
  }

  if (slideData.description) {
    const paragraph = document.createElement('p');
    paragraph.className = 'carousel-description';
    paragraph.textContent = slideData.description;
    bodyCol.append(paragraph);
  }

  const ctas = document.createElement('div');
  ctas.className = 'carousel-ctas';

  const primary = createCta(slideData.primaryCtaText, slideData.primaryCtaLink, 'carousel-cta-primary');
  const secondary = createCta(slideData.secondaryCtaText, slideData.secondaryCtaLink, 'carousel-cta-secondary');

  if (primary) ctas.append(primary);
  if (secondary) ctas.append(secondary);

  if (ctas.children.length > 0) bodyCol.append(ctas);

  li.append(imageCol, bodyCol);
  return li;
}

function updateSlides(track, bullets, newIndex) {
  const slides = [...track.children];

  track.style.transform = `translateX(-${newIndex * 100}%)`;

  slides.forEach((slide, index) => {
    const isActive = index === newIndex;
    slide.setAttribute('aria-hidden', String(!isActive));
    slide.tabIndex = isActive ? 0 : -1;
  });

  bullets.forEach((bullet, index) => {
    const isActive = index === newIndex;
    bullet.classList.toggle('is-active', isActive);
    bullet.setAttribute('aria-current', String(isActive));
  });
}

function createControls(slideCount, onMove, onJump) {
  const controls = document.createElement('div');
  controls.className = 'carousel-controls';

  const prev = document.createElement('button');
  prev.className = 'carousel-nav carousel-nav-prev';
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Previous slide');
  prev.textContent = 'Prev';

  const next = document.createElement('button');
  next.className = 'carousel-nav carousel-nav-next';
  next.type = 'button';
  next.setAttribute('aria-label', 'Next slide');
  next.textContent = 'Next';

  const dots = document.createElement('div');
  dots.className = 'carousel-dots';

  const bullets = Array.from({ length: slideCount }, (_, index) => {
    const bullet = document.createElement('button');
    bullet.type = 'button';
    bullet.className = 'carousel-dot';
    bullet.setAttribute('aria-label', `Go to slide ${index + 1}`);
    bullet.addEventListener('click', () => onJump(index));
    dots.append(bullet);
    return bullet;
  });

  prev.addEventListener('click', () => onMove(-1));
  next.addEventListener('click', () => onMove(1));

  controls.append(prev, dots, next);

  return { controls, bullets };
}

export default function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  const slider = document.createElement('div');
  slider.className = 'carousel-slider';

  const track = document.createElement('ul');
  track.className = 'carousel-track';

  const slides = rows
    .map((row) => {
      const slide = extractSlide(row);
      if (!slide.title && !slide.description && !slide.image) return null;
      return { row, slide };
    })
    .filter(Boolean);

  if (!slides.length) return;

  slides.forEach(({ row, slide }, index) => {
    const slideEl = createSlide(slide, index, slides.length);
    moveInstrumentation(row, slideEl);
    track.append(slideEl);
  });

  slider.append(track);

  let currentIndex = 0;
  let bullets = [];

  const goTo = (index) => {
    currentIndex = (index + slides.length) % slides.length;
    updateSlides(track, bullets, currentIndex);
  };

  if (slides.length > 1) {
    const { controls, bullets: controlBullets } = createControls(
      slides.length,
      (delta) => goTo(currentIndex + delta),
      goTo,
    );
    bullets = controlBullets;
    slider.append(controls);
  }

  block.innerHTML = '';
  block.append(slider);

  updateSlides(track, bullets, currentIndex);

  block.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') goTo(currentIndex - 1);
    if (event.key === 'ArrowRight') goTo(currentIndex + 1);
  });

  const firstHeading = block.querySelector(HEADING_SELECTOR);
  if (!firstHeading) {
    block.setAttribute('aria-label', 'Carousel');
  }
}
