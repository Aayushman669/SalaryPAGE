import "server-only";

import {
  enqueueEmailEvent,
  processEmailQueue,
} from "@/lib/email/queue";
import type { EmailEventInput } from "@/lib/email/types";

export const EmailService = {
  enqueue(event: EmailEventInput) {
    return enqueueEmailEvent(event);
  },
  processQueue(options?: { limit?: number }) {
    return processEmailQueue(options);
  },
};
