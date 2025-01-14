import { useLayoutEffect, useRef } from "react";
import { useLocalization } from "contexts/localization";
import Icon from "components/Icon";
import "./create-button.css";

export default function CreateButton({ children, className, attrs = {}, style = {}, onClick, trackScroll = false }) {
  const locale = useLocalization();
  const ref = useRef(null);
  const scrolling = useRef(false);

  useLayoutEffect(() => {
    if (!trackScroll) {
      return;
    }
    ref.current.previousElementSibling.addEventListener("scroll", handleScroll);

    return () => {
      ref.current.previousElementSibling.removeEventListener("scroll", handleScroll);
    };
  }, [trackScroll]);

  function handleScroll({ target }) {
    if (scrolling.current) {
      return;
    }
    scrolling.current = true;

    requestAnimationFrame(() => {
      if (target.scrollTop === 0) {
        ref.current.classList.remove("shift-up");
      }
      else {
        ref.current.classList.toggle("shift-up", target.scrollTop + target.offsetHeight >= target.scrollHeight - 32);
      }
      scrolling.current = false;
    });
  }

  return (
    <button className={`btn icon-text-btn create-btn${className ? ` ${className}` : ""}`} { ...attrs } style={{ ...style }} ref={ref} onClick={onClick}>
      <Icon id="plus"/>
      <span>{children || locale.global.create}</span>
    </button>
  );
}
