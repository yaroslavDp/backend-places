const { validationResult } = require("express-validator");
const fs = require('fs');
const HttpError = require("../models/http-error");
const Place = require("../models/place");
const getCoordsForAddress = require("../util/location");
const User = require("../models/user");
const mongoose = require("mongoose");

const getPlaceByid = async (req, res, next) => {
  const placeId = req.params.pid;
  let place;
  try {
    place = await Place.findById(placeId);
  } catch (error) {
    const err = new HttpError(
      "Something went wrong, could not find a place",
      500
    );
    return next(err);
  }
  if (!place) {
    const err = new HttpError("Could not find a place for provided id", 404);
    return next(err);
  }
  res.json({ place: place.toObject({ getters: true }) });
};

const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;
  let places;
  try {
    places = await Place.find({ creator: userId });
  } catch (error) {
    const err = new HttpError("Something went wrong, fetching failed!", 500);
    return next(err);
  }
  if (!places || !places.length) {
    return next(
      new HttpError("Could not find places for the provided creator id!", 404)
    );
  }
  res.json({
    places: places.map((place) => place.toObject({ getters: true })), /// to add 'id' without "_"
  });
};

const createPlace = async (req, res, next) => {
  const errors = validationResult(req); //check if any errors (by express-validator)

  if (!errors.isEmpty()) {
    return next(
      new HttpError(
        "Invalid inputs passed: title, description or address. Please, check your data!",
        422
      )
    );
  }
  const { title, description, address } = req.body;

  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    return next(error);
  }

  const createdPlace = new Place({
    title,
    description,
    location: coordinates,
    image: req.file.path,
    address,
    creator: req.userData.userId,
  });

  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (error) {
    const err = new HttpError("Creating place failed, please try again.", 500);
    return next(err);
  }

  if (!user) {
    const err = new HttpError("Could not find user provided by id.", 404);
    return next(err);
  }
  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save({ session: sess });
    user.places.push(createdPlace);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (error) {
    const err = new HttpError("Creating place failed, please try again.", 500);
    return next(err);
  }

  res.status(201).json({ place: createdPlace });
};

const updPlaceById = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(
      new HttpError(
        "Invalid inputs passed: title, description. Please, check your data!",
        422
      )
    );
  }
  const placeId = req.params.pid;
  const { title, description } = req.body;

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (error) {
    const err = new HttpError(
      "Something went wrong, could not update a place!",
      500
    );
    return next(err);
  }

  if (!place) {
    return next(
      new HttpError("Could not find a place for the provided id!", 404)
    );
  }

  if(place.creator.toString() !== req.userData.userId){
    const err = new HttpError(
      "You are not allowed to edit this place!",
      401
    );
    return next(err);
  }

  place.title = title;
  place.description = description;
  try {
    await place.save();
  } catch (error) {
    const err = new HttpError("Updating place failed, please try again.", 500);
    return next(err);
  }
  res.status(200).json({ place: place.toObject({ getters: true }) });
};

const deletePlaceById = async (req, res, next) => {
  const placeId = req.params.pid;
  let place;
  try {
    place = await Place.findById(placeId).populate('creator');
  } catch (error) {
    const err = new HttpError(
      "Something went wrong, could not update a place!",
      500
    );
    return next(err);
  }
  if (!place) {
    return next(
      new HttpError("Could not find a place for the provided id!", 404)
    );
  }

  if(place.creator.id !== req.userData.userId){
    const err = new HttpError(
      "You are not allowed to  this place!",
      401
    );
    return next(err);
  }

  const imagePath = place.image;
  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await place.deleteOne({ session: sess });
    place.creator.places.pull(place)
    await place.creator.save({ session: sess })
    await sess.commitTransaction();
  } catch (error) {
    const err = new HttpError("Deleting place failed, please try again.", 500);
    return next(err);
  }

  fs.unlink(imagePath, err => {
    console.log(err);
  });

  res.status(200).json({ message: "Deleted Successfully!" });
};

exports.getPlaceByid = getPlaceByid; /// Export controllers
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updPlaceById = updPlaceById;
exports.deletePlaceById = deletePlaceById;
