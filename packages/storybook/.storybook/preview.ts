import type { Preview } from '@storybook/react-vite';
import '@hcgstudio/ogma/styles.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'Ogma surface',
      values: [
        { name: 'Ogma surface', value: '#f6f8f7' },
        { name: 'Review dark', value: '#111718' }
      ]
    },
    controls: {
      expanded: true
    },
    a11y: {
      test: 'todo'
    }
  }
};

export default preview;
