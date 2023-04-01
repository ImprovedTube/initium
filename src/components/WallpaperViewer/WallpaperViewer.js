import { useState, useEffect, useRef } from "react";
import { useSettings } from "contexts/settings-context";
import { getIDBWallpaper, updateDownscaledWallpaperPosition } from "services/wallpaper";
import Spinner from "components/Spinner";
import "./wallpaper-viewer.css";

export default function WallpaperViewer({ settings, hide }) {
  const { updateSetting } = useSettings();
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [area, setArea] = useState(null);
  const [image, setImage] = useState(null);
  const containerRef = useRef(null);
  const startingPointerPosition = useRef(null);
  const pointerMoveHandler = useRef(null);
  const updating = useRef(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    if (settings.id) {
      const image = await getIDBWallpaper(settings.id);
      setUrl(URL.createObjectURL(image));
    }
    else {
      setUrl(settings.url);
    }
  }

  function handleLoad({ target }) {
    const { innerWidth, innerHeight } = window;

    target.style.maxWidth = `${innerWidth - 96}px`;
    target.style.maxHeight = `${innerHeight - 64}px`;

    setTimeout(() => {
      const { width, naturalWidth, height, naturalHeight } = target;
      const image = {
        naturalWidth,
        naturalHeight,
        width,
        height
      };
      initArea({ width: innerWidth, height: innerHeight }, image);
      setImage(image);
      setLoading(false);
    }, 200);
  }

  function initArea(viewport, image) {
    const { x, y } = settings;
    const { width, height } = getAreaSize(viewport, image);

    setArea({
      width,
      height,
      x: (x ?? 50) * (image.width - width) / 100,
      y: (y ?? 50) * (image.height - height) / 100
    });
  }

  function getAreaSize(viewport, image) {
    const { width: viewportWidth, height: viewportHeight } = viewport;
    const { width: containerWidth, height: containerHeight } = image;
    const dimension = getLeastScaledDimension(viewport, image);
    let width = 0;
    let height = 0;

    if (dimension === "height") {
      height = containerHeight;
      width = viewportWidth / viewportHeight * height;

      if (width > containerWidth) {
        width = containerWidth;
        height = viewportHeight / viewportWidth * width;
      }
    }
    else {
      width = containerWidth;
      height = viewportHeight / viewportWidth * width;
    }
    return { width, height };
  }

  function getLeastScaledDimension(viewport, image) {
    const { naturalWidth, naturalHeight } = image;
    const { width: viewportWidth, height: viewportHeight } = viewport;
    const widthDiff = Math.abs(naturalWidth - viewportWidth);
    const heightDiff = Math.abs(naturalHeight - viewportHeight);

    if (naturalWidth > viewportWidth || naturalHeight > viewportHeight) {
      return widthDiff > heightDiff ? "height" : "width";
    }
    return widthDiff > heightDiff ? "width" : "height";
  }

  function getPointerPosition({ clientX, clientY }, target) {
    const { left, top } = target.getBoundingClientRect();

    return {
      x: clientX - left,
      y: clientY - top
    };
  }

  function normalizeSelectionAreaPosition(value, dimensionName) {
    const areaDimension = area[dimensionName];
    const imageDimension = image[dimensionName];

    if (value < 0) {
      value = 0;
    }
    else if (value + areaDimension > imageDimension) {
      value = imageDimension - areaDimension;
    }
    return value;
  }

  function handlePointerDown(event) {
    startingPointerPosition.current = getPointerPosition(event, event.currentTarget);
    pointerMoveHandler.current = handlePointerMove;

    window.addEventListener("pointermove", pointerMoveHandler.current);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function handlePointerMove(event) {
    if (updating.current) {
      return;
    }
    updating.current = true;

    requestAnimationFrame(() => {
      const { x, y } = getPointerPosition(event, containerRef.current);

      setArea({
        ...area,
        x: normalizeSelectionAreaPosition(x - startingPointerPosition.current.x, "width"),
        y: normalizeSelectionAreaPosition(y - startingPointerPosition.current.y, "height")
      });
      updating.current = false;
    });
  }

  function handlePointerUp() {
    window.removeEventListener("pointermove", pointerMoveHandler.current);
    pointerMoveHandler.current = null;
  }

  function getWallpaperPosition(value, dimensionName) {
    const areaDimension = area[dimensionName];
    const imageDimension = image[dimensionName];
    const diff = imageDimension - areaDimension;

    if (diff === 0) {
      return 0;
    }
    return value / diff * 100;
  }

  function saveWallpaperPosition() {
    const x = getWallpaperPosition(area.x, "width");
    const y = getWallpaperPosition(area.y, "height");

    updateSetting("appearance", {
      wallpaper: {
        ...settings,
        x,
        y
      }
    });

    updateDownscaledWallpaperPosition(x, y);
    hide();
  }

  function resetArea() {
    setArea({
      ...area,
      x: (image.width / 2) - (area.width / 2),
      y: (image.height / 2) - (area.height / 2)
    });
  }

  return (
    <div className="fullscreen-mask wallpaper-viewer">
      {loading && <Spinner className="wallpaper-viewer-spinner"/>}
      <div className={`wallpaper-viewer-image-content${loading ? " hidden" : ""}`}>
        <div className="container wallpaper-viewer-image-container" ref={containerRef}>
          <img src={url} className="wallpaper-viewer-image" onLoad={handleLoad}/>
          {area && <div className="wallpaper-viewer-area" style={{
            width: `${area.width}px`,
            height: `${area.height}px`,
            transform: `translate(${area.x}px, ${area.y}px)`
          }} onPointerDown={handlePointerDown}></div>}
        </div>
        <div className="container wallpaper-viewer-bar">
          <button className="btn text-btn" onClick={resetArea}>Reset</button>
          <button className="btn text-btn" onClick={hide}>Cancel</button>
          <button className="btn text-btn" onClick={saveWallpaperPosition}>Save</button>
        </div>
      </div>
    </div>
  );
}
