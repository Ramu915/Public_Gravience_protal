/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2597176356")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id = @request.body.user",
    "deleteRule": "@request.auth.id = user",
    "indexes": [
      "CREATE UNIQUE INDEX idx_user_grievance ON votes (user, grievance)"
    ],
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2597176356")

  // update collection data
  unmarshal({
    "createRule": null,
    "deleteRule": null,
    "indexes": [],
    "listRule": null,
    "viewRule": null
  }, collection)

  return app.save(collection)
})
