import type { Meta, StoryObj } from '@storybook/react-vite';
import { OgmaReviewApp, createDefaultOgmaReview } from '@hcgstudio/ogma';

const meta = {
  title: 'Ogma/Review Workspace',
  component: OgmaReviewApp,
  parameters: {
    layout: 'fullscreen'
  },
  args: {
    review: createDefaultOgmaReview(),
    config: {
      cwd: '/workspace/product',
      dataDir: '/workspace/product/.ogma',
      defaultDesignDir: 'designs/ogma',
      reviewUrl: 'http://localhost:4317/review',
      skillUrl: 'https://raw.githubusercontent.com/hcgstudio/ogma/main/docs/skills/ogma/SKILL.md',
      serverStartedAt: new Date().toISOString()
    }
  }
} satisfies Meta<typeof OgmaReviewApp>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ReviewWorkspace: Story = {};
