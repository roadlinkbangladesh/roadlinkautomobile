import { badRequest, unauthorized, success, serverError } from "../../utils/response.js";

export async function login(request, env) {

    try {

        const body = await request.json();

        const username = body.username?.trim();
        const password = body.password;

        if (!username || !password) {
            return badRequest(
                "Username and password are required."
            );
        }

        return success({
            username
        });

    } catch (error) {

        console.error(error);

        return serverError();

    }

}
