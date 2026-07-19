import { hashPassword } from "./utils/password.js";

export default {
    async fetch() {

        const hash = await hashPassword("roadlink123");

        return Response.json({
            hash
        });

    }
};
