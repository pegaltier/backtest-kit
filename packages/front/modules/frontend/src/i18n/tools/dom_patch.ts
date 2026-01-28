import { compose } from "react-declarative";
import { throttle } from "lodash";

const MUTATION_DEBOUNCE = 1;

const mutations: Function[] = [
  () => {
    document.querySelectorAll("input").forEach((input) => {
      if (input.placeholder) {
        input.placeholder = window.Translate.translateText(input.placeholder);
      }
    });
  },

  () => {
    document.querySelectorAll("textarea").forEach((textarea) => {
      if (textarea.placeholder) {
        textarea.placeholder = window.Translate.translateText(
          textarea.placeholder,
        );
      }
    });
  },
];

const dom_patch = () => {
  const pipeline = throttle(
    compose(...mutations.map((callback) => () => void callback())),
    MUTATION_DEBOUNCE,
    {
      trailing: true,
    },
  );

  const observer = new MutationObserver(pipeline);

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
};

document.addEventListener("DOMContentLoaded", dom_patch);
