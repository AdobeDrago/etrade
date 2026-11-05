# Publishing approval setup

Prepared for `/adobedrago/etrade`. The live DA configuration has not been changed. Adobe onboarding and approver identities still need confirmation.

## Confirm with Adobe

Adobe must provision the notification backend. Confirm allowed email domains, the email provider endpoint, sender address/name, and a secure handoff for the provider key. See [Adobe Request Publish setup](https://www.aem.live/docs/ew/administering/request-publish).

Suggested request to your Adobe contact:

> Can you confirm whether Request Publish is onboarded for `/adobedrago/etrade`? We want authors to submit requests from Prepare and approvers to review them in the inbox. Please confirm the notification backend and the remaining email-provider/domain setup, including the secure process for supplying credentials. We also need to agree on the approvers and their page responsibilities.

## Configuration rows

After onboarding, open the [site configuration](https://da.live/config#/adobedrago/etrade/). Preserve existing tabs and rows. These entries follow [Adobe's configuration schema](https://www.aem.live/docs/ew/administering/request-publish#step-2-configure-your-experience-workspace-site).

Add this row on **prepare**:

| title | path | icon | experience |
| --- | --- | --- | --- |
| Request Publish | https://main--aem-apps--adobe-rnd.aem.live/tools/plugins/request-for-publish/request-for-publish.html | https://main--aem-apps--adobe-rnd.aem.live/tools/plugins/request-for-publish/request-for-publish.svg | fullsize-dialog |

Add this row on **apps**:

| title | description | path |
| --- | --- | --- |
| Publish Requests Inbox | Review publishing requests | /app/adobe-rnd/aem-apps/tools/apps/publish-requests-inbox/publish-requests-inbox |

Create **publish-workflow-config** with columns `pattern`, `approvers`, `CC`, `notifyonreject`. Populate actual approved recipients for each path rule, including `/*` as the fallback. Recipient values are intentionally unset here. A narrower rule can override the fallback. Use **publish-workflow-groups-to-email** only if named recipient groups need expansion.

## Permissions and acceptance

Per [Adobe's permission requirements](https://www.aem.live/docs/ew/administering/request-publish#step-3-configure-user-permissions-in-edge-delivery-services), authors need `basic_author` and write access to `/adobedrago/etrade/.da/publish-workflow-requests.json`; approvers need `basic_publish`. An administrator should review existing direct-publish rights against the intended approval policy. Adding the menu entry alone does not remove those rights.

Acceptance on an agreed test page: verify the resolved approvers, preview link, request notification and inbox visibility; then test rejection, withdrawal and approval with the designated participants. Approval publishes content, so that final test needs an explicitly approved test page and release timing.

## Current handoff

- Confirm Adobe onboarding and notification-provider ownership.
- Identify approvers, allowed email domains and any path exceptions.
- Apply the rows and permission changes through an authorized DA administrator.
- Run acceptance with the participants before treating approval routing as enabled.
